'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    link?: string;
    is_read: boolean;
    created_at: string;
}

export async function getUnreadCount() {
    const supabase = await createClient();
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false); // RLS handles user filtering

    if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
    }
    return (count as any) || 0;
}

export async function getNotifications(limit = 20) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
    return (data || []) as Notification[];
}

export async function markAsRead(id: string) {
    const supabase = await createClient();
    const { error } = await (supabase
        .from('notifications') as any)
        .update({ is_read: true })
        .eq('id', id);

    if (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
    revalidatePath('/', 'layout'); // Refresh UI
    return true;
}

export async function markAllAsRead() {
    const supabase = await createClient();

    // RLS handles user filtering, so just update all for current user
    const { error } = await (supabase
        .from('notifications') as any)
        .update({ is_read: true })
        .eq('is_read', false);

    if (error) {
        console.error('Error marking all as read:', error);
        return false;
    }
    revalidatePath('/', 'layout');
    return true;
}
