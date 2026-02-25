import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import NotificationBell from '@/components/notifications/NotificationBell';
import { Toaster } from 'sonner';
import { getAppConfig } from '@/lib/config/server-config';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Obtener perfil del usuario
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        redirect('/login');
    }

    const companyInfo = await getAppConfig('company_info', { name: 'PayMang' });
    const companyName = companyInfo?.name || 'PayMang';

    return (
        <div className="flex h-screen bg-background-main text-gray-900">
            <Sidebar profile={profile as any} companyName={companyName} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                            {(profile as any).role}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                            {(profile as any).full_name?.substring(0, 2).toUpperCase()}
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto">
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </div>
            <Toaster position="top-right" />
        </div>
    );
}
