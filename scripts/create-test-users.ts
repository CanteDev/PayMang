import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials (URL or SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_PASSWORD = 'Password123!';

const users = [
    { email: 'closer@test.com', role: 'closer', name: 'Closer Test' },
    { email: 'coach@test.com', role: 'coach', name: 'Coach Test' },
    { email: 'setter@test.com', role: 'setter', name: 'Setter Test' },
    // Ensure Admin exists too? User probably has one.
];

async function createTestUsers() {
    console.log('Creating test users...');

    for (const user of users) {
        // 1. Check if user exists in Auth
        const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
        let authUser = existingUsers.find(u => u.email === user.email);

        if (!authUser) {
            console.log(`Creating Auth User: ${user.email}`);
            const { data, error } = await supabase.auth.admin.createUser({
                email: user.email,
                password: TEST_PASSWORD,
                email_confirm: true
            });
            if (error) {
                console.error(`Error creating auth user ${user.email}:`, error.message);
                continue;
            }
            authUser = data.user;
        } else {
            console.log(`Auth User ${user.email} already exists. Updating password...`);
            const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
                password: TEST_PASSWORD
            });
            if (updateError) {
                console.error(`Error updating password for ${user.email}:`, updateError.message);
            }
        }

        if (authUser) {
            // 2. Upsert Profile
            console.log(`Updating Profile for: ${user.email} (${user.role})`);
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authUser.id,
                    email: user.email,
                    full_name: user.name,
                    role: user.role,
                    is_active: true
                });

            if (profileError) {
                console.error(`Error updating profile for ${user.email}:`, profileError.message);
            } else {
                console.log(`✅ Configured ${user.role}: ${user.email} / ${TEST_PASSWORD}`);
            }
        }
    }
}

createTestUsers();
