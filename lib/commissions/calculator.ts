import { getAppConfig } from '@/lib/config/server-config';
import type { UserRole } from '@/config/app.config';

/**
 * Calculadora de comisiones según la configuración del sistema
 */

interface CommissionCalculation {
    role: UserRole;
    amount: number;
    percentage: number;
}

/**
 * Calcula el importe de comisión para un rol específico
 */
export async function calculateCommission(
    totalAmount: number,
    role: UserRole
): Promise<number> {
    const rates = await getAppConfig('commission_rates');
    // Normalize keys to lowercase for DB compatibility (e.g. coach vs COACH)
    // The default config uses uppercase keys in code... 
    // In DB seed I used lowercase: {"coach": 0.10...}
    // Let's handle both or standardized.
    // The DB seed has keys as "coach", "closer", "setter".
    // The code CONFIG has "COACH", "CLOSER", "SETTER".

    // We try lowercase first (DB convention), then uppercase (Legacy Config convention)
    const rate = rates[role.toLowerCase()] ?? rates[role.toUpperCase()] ?? 0;

    if (!rate) return 0;

    const commission = totalAmount * rate;
    // Redondear a 2 decimales (regla de usuario)
    return Math.round(commission * 100) / 100;
}

/**
 * Calcula todas las comisiones para una venta
 */
export async function calculateAllCommissions(
    totalAmount: number,
    roles: { coach?: boolean; closer?: boolean; setter?: boolean }
): Promise<CommissionCalculation[]> {
    const commissions: CommissionCalculation[] = [];
    const rates = await getAppConfig('commission_rates');

    if (roles.coach) {
        const rate = rates['coach'] ?? rates['COACH'] ?? 0;
        commissions.push({
            role: 'coach',
            amount: Math.round(totalAmount * rate * 100) / 100,
            percentage: rate,
        });
    }

    if (roles.closer) {
        const rate = rates['closer'] ?? rates['CLOSER'] ?? 0;
        commissions.push({
            role: 'closer',
            amount: Math.round(totalAmount * rate * 100) / 100,
            percentage: rate,
        });
    }

    if (roles.setter) {
        const rate = rates['setter'] ?? rates['SETTER'] ?? 0;
        commissions.push({
            role: 'setter',
            amount: Math.round(totalAmount * rate * 100) / 100,
            percentage: rate,
        });
    }

    return commissions;
}

/**
 * Calcula el importe para un milestone específico de seQura
 */
export async function calculateSeQuraMilestone(
    totalAmount: number,
    milestone: 1 | 2 | 3
): Promise<number> {
    const milestones = await getAppConfig('sequra_milestones');
    // DB keys: initial, second, final
    // Config Legacy: MILESTONE_1, MILESTONE_2, MILESTONE_3

    let percentage = 0;

    if (milestone === 1) percentage = milestones['initial'] ?? milestones['MILESTONE_1'] ?? 0;
    if (milestone === 2) percentage = milestones['second'] ?? milestones['MILESTONE_2'] ?? 0;
    if (milestone === 3) percentage = milestones['final'] ?? milestones['MILESTONE_3'] ?? 0;

    const amount = totalAmount * percentage;
    return Math.round(amount * 100) / 100;
}

/**
 * Genera todas las comisiones para un milestone de seQura
 */
export async function calculateSeQuraCommissions(
    totalAmount: number,
    milestone: 1 | 2 | 3,
    roles: { coach?: boolean; closer?: boolean; setter?: boolean }
): Promise<CommissionCalculation[]> {
    const milestoneAmount = await calculateSeQuraMilestone(totalAmount, milestone);
    return calculateAllCommissions(milestoneAmount, roles);
}

