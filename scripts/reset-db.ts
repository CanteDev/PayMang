import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Falta URL o SERVICE_ROLE_KEY en el .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function resetDB() {
    console.log('🧹 Iniciando limpieza de base de datos...');

    // Tablas a limpiar en orden (o usando CASCADE si fuera SQL directo)
    // Aquí lo hacemos una por una con el cliente admin
    const tables = [
        'notifications',
        'payment_links',
        'commissions',
        'payments',
        'sales',
        'students'
    ];

    for (const table of tables) {
        console.log(`🗑️ Limpiando tabla: ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            console.error(`❌ Error limpiando ${table}:`, error.message);
        } else {
            console.log(`✅ Tabla ${table} vaciada.`);
        }
    }

    console.log('✨ Base de datos reseteada (Profiles y Packs preservados).');
}

resetDB();
