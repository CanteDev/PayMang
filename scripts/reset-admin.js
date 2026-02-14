const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function resetPassword() {
    const email = 'admin@paymang.com';
    const newPassword = 'PrimaveraVerano.01';

    console.log(`Resetting password for ${email}...`);

    const { data: user, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

    if (findError) {
        // If profile not found, maybe user doesn't exist in auth either? 
        // Or maybe profile exists but auth user is missing?
        console.log('Profile lookup failed or not found, trying to update auth user directly by email...');
    }

    // List users to find the ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }



    const adminUser = users.find(u => u.email === email);

    if (!adminUser) {
        console.error(`User ${email} not found in Auth! Creating it...`);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password: newPassword,
            email_confirm: true,
            user_metadata: { full_name: 'Admin PayMang' }
        });

        if (createError) {
            console.error('Error creating user:', createError);
        } else {
            console.log('User created successfully:', newUser);
            // Ensure profile exists
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: newUser.user.id,
                    email: email,
                    full_name: 'Admin PayMang',
                    role: 'admin',
                    is_active: true
                });
            if (profileError) console.error('Error creating profile:', profileError);
            else console.log('Profile created/updated.');
        }
        return;
    }

    console.log(`Found user ${email} with ID ${adminUser.id}. Updating password...`);

    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        { password: newPassword }
    );

    if (updateError) {
        console.error('Error updating password:', updateError);
    } else {
        console.log('✅ Password updated successfully!');
    }
}

resetPassword();
