import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

async function checkProfiles() {
    console.log('🔍 Inspeccionando tabla profiles...');

    const { data, error } = await supabase
        .from('profiles')
        .select('email, full_name, role, is_active')
        .in('role', ['admin', 'closer', 'coach', 'setter']);

    if (error) {
        console.error('❌ Error al acceder a profiles:', error.message);
        return;
    }

    console.log(`✅ Total perfiles encontrados: ${data.length}`);

    const inactive = data.filter(p => p.is_active === false);
    console.log(`🚫 Perfiles inactivos (${inactive.length}):`);
    inactive.forEach(p => console.log(`- ${p.email} (${p.full_name}) - is_active: ${p.is_active}`));

    const jsoriano = data.find(p => p.email === 'jsorianotoro@gmail.com');
    if (jsoriano) {
        console.log(`👤 Usuario jsorianotoro@gmail.com encontrado:`, jsoriano);
    } else {
        console.log(`❓ Usuario jsorianotoro@gmail.com NO encontrado en el listado.`);
    }
}

checkProfiles();
