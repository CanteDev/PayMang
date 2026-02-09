import { CONFIG } from '@/config/app.config';
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
export function calculateCommission(
    totalAmount: number,
    role: UserRole
): number {
    const rate = CONFIG.COMMISSION_RATES[role.toUpperCase() as Uppercase<UserRole>];
    if (!rate) return 0;

    const commission = totalAmount * rate;
    // Redondear a 2 decimales (regla de usuario)
    return Math.round(commission * 100) / 100;
}

/**
 * Calcula todas las comisiones para una venta
 */
export function calculateAllCommissions(
    totalAmount: number,
    roles: { coach?: boolean; closer?: boolean; setter?: boolean }
): CommissionCalculation[] {
    const commissions: CommissionCalculation[] = [];

    if (roles.coach) {
        commissions.push({
            role: 'coach',
            amount: calculateCommission(totalAmount, 'coach'),
            percentage: CONFIG.COMMISSION_RATES.COACH,
        });
    }

    if (roles.closer) {
        commissions.push({
            role: 'closer',
            amount: calculateCommission(totalAmount, 'closer'),
            percentage: CONFIG.COMMISSION_RATES.CLOSER,
        });
    }

    if (roles.setter) {
        commissions.push({
            role: 'setter',
            amount: calculateCommission(totalAmount, 'setter'),
            percentage: CONFIG.COMMISSION_RATES.SETTER,
        });
    }

    return commissions;
}

/**
 * Calcula el importe para un milestone específico de seQura
 */
export function calculateSeQuraMilestone(
    totalAmount: number,
    milestone: 1 | 2 | 3
): number {
    const milestoneKey = `MILESTONE_${milestone}` as keyof typeof CONFIG.SEQURA_MILESTONES;
    const percentage = CONFIG.SEQURA_MILESTONES[milestoneKey];

    const amount = totalAmount * percentage;
    return Math.round(amount * 100) / 100;
}

/**
 * Genera todas las comisiones para un milestone de seQura
 */
export function calculateSeQuraCommissions(
    totalAmount: number,
    milestone: 1 | 2 | 3,
    roles: { coach?: boolean; closer?: boolean; setter?: boolean }
): CommissionCalculation[] {
    const milestoneAmount = calculateSeQuraMilestone(totalAmount, milestone);
    return calculateAllCommissions(milestoneAmount, roles);
}
