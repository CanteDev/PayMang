'use server';

import { createClient } from '@/lib/supabase/server';
import { CommissionStatus, UserRole } from '@/config/app.config';
import { revalidatePath } from 'next/cache';

export async function getDashboardMetrics(startDate?: string, endDate?: string) {
    const supabase = await createClient();

    // 1. Total Revenue (Gross): Sum of all PAID payments (Actual Cash Flow)
    // We query 'payments' directly to avoid double counting from 'sales' view
    let query = supabase
        .from('payments')
        .select('amount')
        .eq('status', 'paid');

    if (startDate) query = query.gte('paid_at', startDate);
    if (endDate) query = query.lte('paid_at', endDate);

    const { data: paymentsData, error: payError } = await query;

    if (payError) {
        console.error('Error fetching payments for revenue:', payError);
        return { totalRevenue: 0, netCashFlow: 0, pendingPayouts: 0, burnRate: 0 };
    }

    const totalRevenue = (paymentsData as any[]).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);


    // 2. Commissions:
    // We need both PAID in period (for cash flow) and PENDING generated in period (for metrics)
    const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select('amount, status, paid_at, created_at');
    // For performance and range, we fetch a slightly wider set or filter specifically.
    // Given the small data size, filtering in memory is safe and more precise for combined logic.

    if (commissionsError) {
        console.error('Error fetching commissions:', commissionsError);
        return null;
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    const paidCommissions = (commissionsData as any[])
        .filter(c => {
            if (c.status !== 'paid' || !c.paid_at) return false;
            const pDate = new Date(c.paid_at);
            return pDate >= start && pDate <= end;
        })
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const pendingPayouts = (commissionsData as any[])
        .filter(c => {
            // Only include commissions that are actually waiting to be paid
            const isActionable = ['pending', 'validated', 'incidence'].includes(c.status);
            if (!isActionable) return false;

            const cDate = new Date(c.created_at);
            return cDate >= start && cDate <= end;
        })
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // 3. Expenses: Sum of all expenses overlapping with the period
    const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, type, start_date, end_date, recurring');

    if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
        return null;
    }

    let totalExpenses = 0;
    let burnRate = 0;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    (expensesData as any[]).forEach(e => {
        const eStart = new Date(e.start_date);
        const eEnd = e.end_date ? new Date(e.end_date) : new Date(2100, 0, 1);
        const amount = Number(e.amount) || 0;

        // --- Period Expenses Calculation (Within filters) ---
        // We calculate what part of this expense belongs to the filtered [start, end]
        if (e.recurring) {
            // Count months in period [start, end] that overlap with [eStart, eEnd]
            const overlapStart = new Date(Math.max(start.getTime(), eStart.getTime()));
            const overlapEnd = new Date(Math.min(end.getTime(), eEnd.getTime(), now.getTime()));

            if (overlapStart <= overlapEnd) {
                const months = (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12 +
                    (overlapEnd.getMonth() - overlapStart.getMonth()) + 1;
                if (months > 0) totalExpenses += amount * months;
            }
        } else {
            // One-time: Does it fall in the period?
            if (eStart >= start && eStart <= end) {
                totalExpenses += amount;
            }
        }

        // --- Burn Rate (Current Month Fixed) ---
        if (e.recurring) {
            const isActiveThisMonth = eStart <= currentMonthEnd && eEnd >= currentMonthStart;
            if (isActiveThisMonth) burnRate += amount;
        } else {
            if (eStart >= currentMonthStart && eStart <= currentMonthEnd) burnRate += amount;
        }
    });

    // Net Cash Flow = Revenue - Paid Commissions - Expenses (in period)
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

    // Range: 3 months back, Current, 3 months forward = 7 months total
    const now = new Date();
    const chartData: { month: string; generated: number; paid: number; planned: number; sortKey: string }[] = [];

    for (let i = -3; i <= 3; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const label = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });

        chartData.push({
            month: label,
            generated: 0,
            paid: 0,
            planned: 0,
            sortKey: monthKey
        });
    }

    const startWindow = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    const endWindow = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString(); // End of +3 month

    // 1. Get Commissions (Past & Current)
    let commQuery = supabase
        .from('commissions')
        .select('amount, status, created_at')
        .gte('created_at', startWindow)
        .lte('created_at', endWindow);

    if (userId) commQuery = commQuery.eq('agent_id', userId);

    const { data: commissions } = await commQuery;

    // 2. Get Planned Payments (Future & Current)
    // Exclude payments from students with non-billable statuses (defaulted, finished, inactive)
    let payQuery = supabase
        .from('payments')
        .select('amount, due_date, sale:sales!inner(student:students!inner(status))')
        .in('status', ['pending', 'overdue'])
        .gte('due_date', startWindow)
        .lte('due_date', endWindow);

    const { data: plannedPaymentsRaw } = await payQuery;

    // Filter out payments from students that are not actively paying
    const EXCLUDED_STUDENT_STATUSES = ['defaulted', 'finished', 'inactive'];
    const plannedPayments = (plannedPaymentsRaw as any[] || []).filter(p => {
        const studentStatus = (p as any).sale?.student?.status;
        return !EXCLUDED_STUDENT_STATUSES.includes(studentStatus);
    });

    // Process commissions
    (commissions as any[] || []).forEach(c => {
        const date = new Date(c.created_at);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const entry = chartData.find(d => d.sortKey === monthKey);
        if (entry) {
            if (c.status === 'paid') {
                entry.paid += Number(c.amount);
            } else if (['pending', 'validated', 'incidence'].includes(c.status)) {
                entry.generated += Number(c.amount);
            }
        }
    });

    // Process planned payments
    (plannedPayments as any[] || []).forEach(p => {
        const date = new Date(p.due_date);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const entry = chartData.find(d => d.sortKey === monthKey);
        if (entry) {
            entry.planned += Number(p.amount);
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
        return { commissions: [], summary: { generatedThisMonth: 0, received: 0, remaining: 0 } };
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
        overduePayments?: number;
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

        // Count Overdue Payments - exclude non-active students
        const today = new Date().toISOString().split('T')[0];
        const { data: overdueData } = await (supabase
            .from('payments') as any)
            .select('id, sale:sales!inner(student:students!inner(status))')
            .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`);

        // Only count payments from active/paused students
        const EXCLUDED_STATUSES = ['defaulted', 'finished', 'inactive'];
        const overdueCount = (overdueData || []).filter((p: any) => {
            const studentStatus = p.sale?.student?.status;
            return !EXCLUDED_STATUSES.includes(studentStatus);
        }).length;

        results.pendingPayouts = validatedCount || 0;
        results.newIncidences = incidenceCount || 0;
        results.overduePayments = overdueCount || 0;
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
