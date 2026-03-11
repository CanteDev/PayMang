const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' }); // Fallback

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Faltan variables de entorno SUPABASE_URL o SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
    { name: 'Carlos', email: 'Carlos.ecombomb@gmail.com' },
    { name: 'Simon', email: 'ac.simon.ecombomb@gmail.com' },
    { name: 'Didac', email: 'didactrafficker@gmail.com' },
    { name: 'Raul', email: 'raulpf78@gmail.com' },
    { name: 'Dani', email: 'individual.ecomcoach@gmail.com' },
    { name: 'Manel', email: 'manelecombomb@gmail.com' }
];

async function run() {
    const results = [];
    
    // Get all users to avoid duplicates
    let allUsers = [];
    let page = 1;
    let hasMore = true;
    while(hasMore) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
        if (error) break;
        allUsers = allUsers.concat(data.users);
        if (data.users.length < 100) hasMore = false;
        page++;
    }

    for (const u of users) {
        // Generate a random password that passes common requirements (letters, numbers, symbols)
        const password = Math.random().toString(36).slice(-6) + 'Pm8!'; 
        
        const exists = allUsers.find(user => user.email.toLowerCase() === u.email.toLowerCase());
        
        if (exists) {
            results.push({ Nombre: u.name, Email: u.email, Password: 'Ya existía (no alterado)', Estado: 'Saltado' });
            continue;
        }

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: u.name,
                role: 'coach'
            }
        });

        if (authError) {
            console.error('Error creating user ' + u.email, authError);
            results.push({ Nombre: u.name, Email: u.email, Password: '-', Estado: 'Error Auth' });
            continue;
        }

        const userId = authData.user.id;
        
        // Ensure profile is created (sometimes triggers do it, sometimes not, handle quietly)
        const { error: profileError } = await supabase.from('profiles').insert({
            id: userId,
            email: u.email,
            full_name: u.name,
            role: 'coach',
            is_active: true
        });

        if (profileError) {
            if (profileError.code === '23505') { // duplicate key
                results.push({ Nombre: u.name, Email: u.email, Password: password, Estado: 'Creado OK (Trigger)' });
            } else {
                results.push({ Nombre: u.name, Email: u.email, Password: password, Estado: 'Error Perfil: ' + profileError.message });
            }
        } else {
             results.push({ Nombre: u.name, Email: u.email, Password: password, Estado: 'Creado OK' });
        }
    }

    console.table(results);
    console.log("JSON_DUMP:::" + JSON.stringify(results));
}

run();
