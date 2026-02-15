import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

async function checkSchema() {
    console.log('🔍 Inspeccionando tabla students...');

    // Intentamos insertar un registro dummy y cancelarlo, o simplemente hacer un select de una fila
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error al acceder a students:', error.message);
    } else {
        console.log('✅ Columnas encontradas en el primer registro (o vacio):', data.length > 0 ? Object.keys(data[0]) : 'Tabla vacía, no se pueden ver columnas por SELECT *');
    }

    // Intentamos un select específico de las columnas que deberían existir
    const cols = ['pack_id', 'payment_method', 'total_installments', 'agreed_price'];
    for (const col of cols) {
        const { error: colError } = await supabase
            .from('students')
            .select(col)
            .limit(1);

        if (colError) {
            console.log(`❌ Columna [${col}] NO EXISTE o error:`, colError.message);
        } else {
            console.log(`✅ Columna [${col}] EXISTE.`);
        }
    }
}

checkSchema();
