'use server';

import { createClient } from '@/lib/supabase/server';
import { CommissionStatus, UserRole } from '@/config/app.config';
import { revalidatePath } from 'next/cache';

export async function getDashboardMetrics() {
    const supabase = await createClient();

    // 1. Total Revenue (Gross): Sum of all sales
    const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, amount_collected');

    if (salesError) {
        console.error('Error fetching sales:', salesError);
        return null;
    }

    const totalRevenue = (salesData as any[]).reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

    // 2. Paid Commissions: Sum of all PAID commissions
    const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select('amount, status');

    if (commissionsError) {
        console.error('Error fetching commissions:', commissionsError);
        return null;
    }

    const paidCommissions = (commissionsData as any[])
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

    const pendingPayouts = (commissionsData as any[])
        .filter(c => c.status === 'validated' || c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

    // 3. Expenses: Sum of all expenses
    const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, type, start_date, end_date, recurring');

    if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
        return null;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Helper to calculate months difference inclusive
    const getMonthsDifference = (start: Date, end: Date) => {
        return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    };

    let totalExpenses = 0;
    let burnRate = 0;

    (expensesData as any[]).forEach(e => {
        const startDate = new Date(e.start_date);
        const amount = Number(e.amount) || 0;

        // Skip future expenses for total calculation
        if (startDate > now) return;

        // --- Total Expenses Calculation (All Time) ---
        if (e.recurring) {
            // Recurring: Calculate how many times it has occurred up to now
            // End date for calculation is min(e.end_date, now)
            let limitDate = now;
            if (e.end_date) {
                const endDate = new Date(e.end_date);
                if (endDate < now) limitDate = endDate;
            }

            // Only count if limitDate >= startDate
            if (limitDate >= startDate) {
                const monthsActive = getMonthsDifference(startDate, limitDate);
                // Safety check for negative months (shouldn't happen with correct dates)
                if (monthsActive > 0) {
                    totalExpenses += amount * monthsActive;
                }
            }
        } else {
            // One-time: Just add amount
            totalExpenses += amount;
        }

        // --- Burn Rate Calculation (Current Month Only) ---
        // Definition: Expenses occurring in the current month (Fixed only usually, but let's include all to be safe or stick to 'fijo' if that's the business logic)
        // Previous logic checked 'fijo' only. Let's strict to 'fijo' for Burn Rate as it implies overhead.

        // --- Monthly Expenses Calculation (Current Month Only) ---
        // Definition: Expenses occurring in the current month (Fixed AND Variable)

        if (e.recurring) {
            // If recurring, is it active this month?
            // Active if: start_date <= end_of_this_month AND (end_date is null OR end_date >= start_of_this_month)

            const monthStart = new Date(currentYear, currentMonth, 1);
            const monthEnd = new Date(currentYear, currentMonth + 1, 0);

            const isActive = startDate <= monthEnd && (!e.end_date || new Date(e.end_date) >= monthStart);

            if (isActive) {
                burnRate += amount;
            }
        } else {
            // One-time: Did it happen this month?
            if (startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
                burnRate += amount;
            }
        }
    });

    // Net Cash Flow = Revenue - Paid Commissions - Total Expenses
    const netCashFlow = totalRevenue - paidCommissions - totalExpenses;

    return {
        totalRevenue,
        netCashFlow,
        pendingPayouts,
        burnRate
    };
}

export async function getCommissionChartData(userId?: string) {
    const supabase = await createClient();

    // Calculate range: last 6 months
    const now = new Date();
    const monthsToShow = 6;
    const chartData: { month: string; generated: number; paid: number; sortKey: string }[] = [];

    // Initialize the last 6 months with 0s
    for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        // Locale 'es-ES' for Spanish months
        const label = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });

        chartData.push({
            month: label,
            generated: 0,
            paid: 0,
            sortKey: monthKey
        });
    }

    const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsToShow - 1), 1).toISOString();

    let query = supabase
        .from('commissions')
        .select('amount, status, created_at, paid_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

    if (userId) {
        query = query.eq('agent_id', userId);
    }

    const { data: commissions, error } = await query;

    if (error) {
        console.error('Error fetching chart data:', error);
        return chartData.map(({ sortKey, ...rest }) => rest);
    }

    // Process commissions
    (commissions as any[]).forEach(commission => {
        const date = new Date(commission.created_at);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        const existingMonth = chartData.find(d => d.sortKey === monthKey);
        if (existingMonth) {
            if (commission.status === 'paid') {
                existingMonth.paid += Number(commission.amount);
            } else if (['pending', 'validated', 'incidence'].includes(commission.status)) {
                existingMonth.generated += Number(commission.amount);
            }
        }
    });

    return chartData.map(({ sortKey, ...rest }) => rest);
}

export async function getStaffCommissionStats(userId?: string) {
    const supabase = await createClient();

    if (!userId) {
        return { commissions: [], summary: { generatedThisMonth: 0, received: 0, remaining: 0 } };
    }

    const { data: commissions, error } = await supabase
        .from('commissions')
        .select(`
            *,
            sale:sales(
                pack:packs(name),
                student:students(full_name)
            )
        `)
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching staff stats:', error);
        return { commissions: [], summary: { generated: 0, received: 0, remaining: 0 } };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const generatedThisMonth = (commissions as any[])
        .filter(c => {
            const date = new Date(c.created_at);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((sum, c) => sum + (c.amount || 0), 0);

    const received = (commissions as any[])
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

    const remaining = (commissions as any[])
        .filter(c => ['pending', 'validated', 'incidence'].includes(c.status))
        .reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
        commissions: commissions as any[],
        summary: {
            generatedThisMonth,
            received,
            remaining
        }
    };
}

export async function getAlertCounts() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile) return null;

    const results: {
        pendingPayouts?: number;
        newIncidences?: number;
        pendingValidations?: number;
    } = {};

    const role = (profile as any).role;

    if (role === 'admin') {
        const { count: validatedCount } = await supabase
            .from('commissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'validated');

        const { count: incidenceCount } = await supabase
            .from('commissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'incidence');

        results.pendingPayouts = validatedCount || 0;
        results.newIncidences = incidenceCount || 0;
    } else {
        const { count: pendingCount } = await supabase
            .from('commissions')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'pending');

        results.pendingValidations = pendingCount || 0;
    }

    return results;
}
