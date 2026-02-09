import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';

/**
 * Cron job para procesar settlements de seQura
 * Se ejecuta diariamente a las 06:00 AM
 * 
 * Configurar en vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sequra-settlements",
 *     "schedule": "0 6 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // Verificar autorización (Vercel Cron Secret)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('🕐 Iniciando worker de seQura settlements...');

        const supabase = await createClient();

        // 1. Llamar a la API de seQura para obtener settlements del día anterior
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        const settlements = await fetchSeQuraSettlements(dateStr);

        if (!settlements || settlements.length === 0) {
            console.log('ℹ️ No hay settlements para procesar');
            return NextResponse.json({
                success: true,
                message: 'No settlements to process',
                processed: 0
            });
        }

        let processedCount = 0;
        let errorCount = 0;

        // 2. Procesar cada settlement
        for (const settlement of settlements) {
            try {
                await processSettlement(settlement, supabase);
                processedCount++;
            } catch (error) {
                console.error('Error procesando settlement:', settlement.id, error);
                errorCount++;
            }
        }

        console.log(`✅ Worker completado: ${processedCount} procesados, ${errorCount} errores`);

        return NextResponse.json({
            success: true,
            processed: processedCount,
            errors: errorCount,
        });

    } catch (error) {
        console.error('❌ Error en worker de seQura:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Obtener settlements de seQura para una fecha
 */
async function fetchSeQuraSettlements(date: string): Promise<any[]> {
    const apiUrl = CONFIG.GATEWAYS.SEQURA.API_URL;
    const merchantId = CONFIG.GATEWAYS.SEQURA.MERCHANT_ID;
    const apiKey = CONFIG.GATEWAYS.SEQURA.API_KEY;

    if (!apiUrl || !merchantId || !apiKey) {
        console.error('Configuración de seQura incompleta');
        return [];
    }

    try {
        const response = await fetch(
            `${apiUrl}/merchants/${merchantId}/settlements?date=${date}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            console.error('Error en API de seQura:', response.status);
            return [];
        }

        const data = await response.json();
        return data.settlements || [];
    } catch (error) {
        console.error('Error llamando a API de seQura:', error);
        return [];
    }
}

/**
 * Procesar un settlement individual
 */
async function processSettlement(settlement: any, supabase: any) {
    const {
        order_id,
        milestone_percentage,
        amount,
        milestone_number,
    } = settlement;

    // Buscar la venta original usando el order_id como link_id
    const { data: link } = await supabase
        .from('payment_links')
        .select('*, pack:packs(*)')
        .eq('id', order_id)
        .single();

    if (!link) {
        console.warn(`Link no encontrado para order_id: ${order_id}`);
        return;
    }

    const { data: sale } = await supabase
        .from('sales')
        .select('*')
        .eq('transaction_id', order_id)
        .eq('gateway', 'sequra')
        .single();

    const { coach_id, closer_id, setter_id } = link.metadata || {};

    // Si es el primer milestone y no existe venta, crear la venta
    if (!sale && milestone_number === 1) {
        const { data: newSale, error: saleError } = await supabase
            .from('sales')
            .insert({
                student_id: link.student_id,
                pack_id: link.pack_id,
                amount: link.pack.price,
                gateway: 'sequra',
                transaction_id: order_id,
                status: 'paid',
                metadata: {
                    settlement_id: settlement.id,
                    milestone: milestone_number,
                },
            })
            .select()
            .single();

        if (saleError) {
            throw saleError;
        }

        // Crear comisiones proporcionales al milestone
        await createMilestoneCommissions({
            saleId: newSale.id,
            totalAmount: link.pack.price,
            milestonePercentage: milestone_percentage,
            milestoneNumber: milestone_number,
            coachId: coach_id,
            closerId: closer_id,
            setterId: setter_id,
            supabase,
        });

    } else if (sale) {
        // Ya existe la venta, solo crear comisiones del nuevo milestone
        await createMilestoneCommissions({
            saleId: sale.id,
            totalAmount: sale.amount,
            milestonePercentage: milestone_percentage,
            milestoneNumber: milestone_number,
            coachId: coach_id,
            closerId: closer_id,
            setterId: setter_id,
            supabase,
        });
    }
}

/**
 * Crear comisiones proporcionales a un milestone
 */
async function createMilestoneCommissions({
    saleId,
    totalAmount,
    milestonePercentage,
    milestoneNumber,
    coachId,
    closerId,
    setterId,
    supabase,
}: {
    saleId: string;
    totalAmount: number;
    milestonePercentage: number;
    milestoneNumber: number;
    coachId: string;
    closerId: string;
    setterId?: string;
    supabase: any;
}) {
    const commissions: any[] = [];

    // Base para cálculo: monto del milestone
    const milestoneAmount = totalAmount * (milestonePercentage / 100);

    // Coach: 10% del milestone
    if (coachId) {
        commissions.push({
            sale_id: saleId,
            agent_id: coachId,
            agent_role: 'coach',
            amount: calculateCommission(milestoneAmount, CONFIG.COMMISSION_RATES.COACH),
            status: 'pending',
            milestone: milestoneNumber,
        });
    }

    // Closer: 8% del milestone
    if (closerId) {
        commissions.push({
            sale_id: saleId,
            agent_id: closerId,
            agent_role: 'closer',
            amount: calculateCommission(milestoneAmount, CONFIG.COMMISSION_RATES.CLOSER),
            status: 'pending',
            milestone: milestoneNumber,
        });
    }

    // Setter: 1% del milestone (opcional)
    if (setterId) {
        commissions.push({
            sale_id: saleId,
            agent_id: setterId,
            agent_role: 'setter',
            amount: calculateCommission(milestoneAmount, CONFIG.COMMISSION_RATES.SETTER),
            status: 'pending',
            milestone: milestoneNumber,
        });
    }

    const { error } = await supabase
        .from('commissions')
        .insert(commissions);

    if (error) {
        throw error;
    }

    console.log(`✅ ${commissions.length} comisiones creadas para milestone ${milestoneNumber}`);
}
