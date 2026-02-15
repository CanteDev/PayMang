'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function inviteStaff(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as string;

    if (!email || !fullName || !role) {
        return { error: 'Faltan campos obligatorios' };
    }

    // Role validation
    const validRoles = ['admin', 'coach', 'closer', 'setter'];
    if (!validRoles.includes(role)) {
        return { error: 'Rol inválido' };
    }

    try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 1. Invite User via Auth Admin API
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: fullName,
                role: role,
            },
            redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/auth/update-password', // Redirect to password set page
        });

        if (authError) {
            console.error('Error inviting user:', authError);
            return { error: authError.message };
        }

        const userId = authData.user.id;

        // 2. Ensure Profile Exists (if trigger didn't catch it or for consistency)
        // Check if profile exists first to avoid duplicate key error if trigger ran
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (!existingProfile) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    email: email,
                    full_name: fullName,
                    role: role, // Cast to enum if needed, but string usually works
                    is_active: true,
                });

            if (profileError) {
                console.error('Error creating profile:', profileError);
                // Optional: Delete auth user if profile creation fails? 
                // For now, return error.
                return { error: 'Usuario invitado, pero error al crear perfil: ' + profileError.message };
            }
        } else {
            // Update role/name if it existed (e.g. re-invite)
            await supabase.from('profiles').update({ role, full_name: fullName, is_active: true }).eq('id', userId);
        }

        revalidatePath('/admin/staff');
        return { success: true, message: 'Invitación enviada correctamente' };

    } catch (error: any) {
        console.error('Server Action Error:', error);
        return { error: 'Error del servidor: ' + error.message };
    }
}

export async function updateStaff(prevState: any, formData: FormData) {
    const id = formData.get('id') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as string;
    const isActive = formData.get('isActive') === 'on';

    if (!id || !fullName || !role) {
        return { error: 'Faltan datos obligatorios para actualizar' };
    }

    const validRoles = ['admin', 'coach', 'closer', 'setter'];
    if (!validRoles.includes(role)) {
        return { error: 'Rol inválido' };
    }

    try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // 1. Fetch current profile state
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('is_active, email')
            .eq('id', id)
            .single();

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                role: role,
                is_active: isActive
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating profile:', error);
            return { error: 'Error al actualizar perfil: ' + error.message };
        }

        // 2. If reactivating (false -> true), trigger invitation email
        if (currentProfile && !currentProfile.is_active && isActive) {
            console.log('Reactivating user, sending invitation:', currentProfile.email);
            const { error: authError } = await supabase.auth.admin.inviteUserByEmail(currentProfile.email, {
                data: {
                    full_name: fullName,
                    role: role,
                },
                redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/auth/update-password',
            });

            if (authError) {
                console.error('Error sending reactivation invite:', authError);
                // We don't return error here because the profile WAS updated, just the email failed.
            }
        }

        revalidatePath('/admin/staff');
        return { success: true, message: 'Miembro actualizado correctamente' };

    } catch (error: any) {
        console.error('Server Action Error:', error);
        return { error: 'Error del servidor: ' + error.message };
    }
}
