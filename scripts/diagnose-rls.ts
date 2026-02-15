import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usamos el Service Role para ver la realidad de la tabla sin filtros RLS
const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function diagnoseRLS() {
    console.log('🧪 Iniciando diagnóstico de perfiles y RLS...');

    // 1. Ver qué perfiles existen realmente
    const { data: allProfiles, error: fetchError } = await adminClient
        .from('profiles')
        .select('id, email, role, is_active');

    if (fetchError) {
        console.error('❌ Error (Admin) al listar perfiles:', fetchError.message);
        return;
    }

    console.log(`✅ Se encontraron ${allProfiles.length} perfiles en total.`);

    // 2. Simular acceso para cada usuario (usando el Service Role no podemos simular RLS fácilmente sin cambiar el rol en Postgres, 
    // pero podemos intentar un select simple con un cliente anonimo si conocemos el ID)
    // Nota: Para probar RLS de verdad necesitaríamos un token de usuario.

    // Vamos a revisar si hay algo obvio en los datos.
    allProfiles.forEach(p => {
        console.log(`👤 User: ${p.email} | Role: ${p.role} | Active: ${p.is_active} | ID: ${p.id}`);
    });

    console.log('\n💡 Nota: Si el error es "Infinite Recursion", suele ser por la política que consulta la propia tabla profiles.');
}

diagnoseRLS();
