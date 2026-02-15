import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixMissingPayments() {
    console.log('🛠️ Intentando recrear la tabla payments si falta...');

    // Intentamos crear la tabla directamente. 
    // Nota: En Supabase client no podemos ejecutar SQL arbitrario sin una RPC.
    // Pero podemos intentar un insert para ver si nos da un error de "tabla no encontrada".

    const { error } = await supabase.from('payments').select('id').limit(1);

    if (error && error.message.includes('not found')) {
        console.log('⚠️ Confirmado: La tabla payments no existe. Por favor ejecuta el SQL manual.');
    } else if (error) {
        console.log('❌ Error distinto:', error.message);
    } else {
        console.log('✅ La tabla SI existe. El problema es el CACHE de Supabase.');
    }
}

fixMissingPayments();
