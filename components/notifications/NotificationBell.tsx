'use client';

import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    Notification
} from '@/app/actions/notifications';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const fetchNotifications = async () => {
        const [data, count] = await Promise.all([
            getNotifications(10),
            getUnreadCount()
        ]);
        setNotifications(data);
        setUnreadCount(count);
    };

    useEffect(() => {
        fetchNotifications();

        // Configurar tiempo real
        const channel = supabase
            .channel('notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications'
                },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleMarkAsRead = async (id: string, link?: string) => {
        await markAsRead(id);
        fetchNotifications();
        if (link) {
            setIsOpen(false);
            router.push(link);
        }
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        fetchNotifications();
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-100 text-green-800 border-green-200';
            case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'error': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5 text-gray-600" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white border-white border-2"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-sm text-gray-900">Notificaciones</h3>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-blue-600 hover:underline font-medium"
                        >
                            Marcar todo como leído
                        </button>
                    )}
                </div>
                <ScrollArea className="h-80">
                    {notifications.length > 0 ? (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b last:border-0 cursor-pointer transition-colors hover:bg-gray-50 ${!notification.is_read ? 'bg-blue-50/50' : ''}`}
                                    onClick={() => handleMarkAsRead(notification.id, notification.link)}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm text-gray-900">{notification.title}</span>
                                            <Badge variant="outline" className={`text-[10px] px-1 py-0 uppercase ${getTypeColor(notification.type)}`}>
                                                {notification.type}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <span className="text-[10px] text-gray-400 mt-1">
                                            {new Intl.DateTimeFormat('es-ES', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).format(new Date(notification.created_at))}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <Bell className="h-8 w-8 text-gray-200 mb-2" />
                            <p className="text-sm text-gray-500">No tienes notificaciones</p>
                        </div>
                    )}
                </ScrollArea>
                <Separator />
                <div className="p-2 text-center">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-gray-500 font-normal">
                        Ver todas las notificaciones
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
