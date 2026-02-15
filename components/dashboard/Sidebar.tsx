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
    LogOut,
    Settings
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
    const handleLogout = async () => {
        const supabase = createClient();
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
                    { href: '/admin/payslips', label: 'Comisiones', icon: FileText },
                    { href: '/admin/expenses', label: 'Gastos', icon: TrendingUp },
                    { href: '/admin/settings', label: 'Configuración', icon: Settings },
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
        <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen">
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold">PM</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">PayMang</h1>
                        <p className="text-xs text-gray-400">Gestión de comisiones</p>
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
                                flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200
                                ${isActive
                                    ? 'bg-gray-700 text-white'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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
            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-semibold">
                                {profile.full_name?.charAt(0) || profile.email.charAt(0)}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {profile.full_name || 'Usuario'}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white text-sm font-medium transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar sesión</span>
                </button>
            </div>
        </aside>
    );
}
