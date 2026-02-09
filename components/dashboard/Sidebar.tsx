'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    DollarSign,
    FileText,
    AlertCircle,
    Link as LinkIcon,
    UserCog,
    TrendingUp,
    LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

interface SidebarProps {
    profile: Profile;
}

export default function Sidebar({ profile }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    // Navegación según el rol
    const getNavItems = () => {
        const baseRole = profile.role;

        switch (baseRole) {
            case 'admin':
                return [
                    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
                    { href: '/admin/staff', label: 'Equipo', icon: UserCog },
                    { href: '/admin/students', label: 'Alumnos', icon: Users },
                    { href: '/admin/payments', label: 'Pagos', icon: DollarSign },
                    { href: '/admin/payslips', label: 'Liquidaciones', icon: FileText },
                    { href: '/admin/incidences', label: 'Incidencias', icon: AlertCircle },
                    { href: '/admin/expenses', label: 'Gastos', icon: TrendingUp },
                ];
            case 'closer':
                return [
                    { href: '/closer', label: 'Dashboard', icon: LayoutDashboard },
                    { href: '/closer/links', label: 'Generar Link', icon: LinkIcon },
                    { href: '/closer/students', label: 'Alumnos', icon: Users },
                    { href: '/closer/commissions', label: 'Mis Comisiones', icon: DollarSign },
                    { href: '/closer/payslips', label: 'Mis Liquidaciones', icon: FileText },
                ];
            case 'coach':
                return [
                    { href: '/coach', label: 'Dashboard', icon: LayoutDashboard },
                    { href: '/coach/students', label: 'Mis Alumnos', icon: Users },
                    { href: '/coach/commissions', label: 'Mis Comisiones', icon: DollarSign },
                    { href: '/coach/payslips', label: 'Mis Liquidaciones', icon: FileText },
                ];
            case 'setter':
                return [
                    { href: '/setter', label: 'Dashboard', icon: LayoutDashboard },
                    { href: '/setter/commissions', label: 'Mis Comisiones', icon: DollarSign },
                    { href: '/setter/payslips', label: 'Mis Liquidaciones', icon: FileText },
                ];
            default:
                return [];
        }
    };

    const navItems = getNavItems();

    return (
        <aside className="w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
                        <span className="text-lg font-bold">PM</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">PayMang</h1>
                        <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive
                                    ? 'bg-white/10 text-white shadow-lg'
                                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                }
              `}
                        >
                            <Icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t border-gray-700 space-y-3">
                <div className="px-4 py-2">
                    <p className="text-sm font-medium truncate">{profile.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{profile.email}</p>
                </div>
                <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/5 rounded-lg"
                >
                    <LogOut size={20} className="mr-3" />
                    Cerrar Sesión
                </Button>
            </div>
        </aside>
    );
}
