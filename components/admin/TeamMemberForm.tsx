'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { inviteStaff, updateStaff } from '@/app/actions/staff';

interface TeamMemberFormProps {
    member?: {
        id: string;
        email: string;
        full_name: string;
        role: string;
        is_active: boolean;
    };
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export default function TeamMemberForm({ member, trigger, onSuccess }: TeamMemberFormProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('coach');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (open) {
            if (member) {
                setEmail(member.email || '');
                setFullName(member.full_name || '');
                setRole(member.role || 'coach');
                setIsActive(member.is_active);
            } else {
                resetForm();
            }
        }
    }, [open, member]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('email', email);
        formData.append('fullName', fullName);
        formData.append('role', role);
        if (isActive) formData.append('isActive', 'on');

        try {
            let result;
            if (member) {
                // Update existing member
                formData.append('id', member.id);
                result = await updateStaff(null, formData);
            } else {
                // Invite new member
                result = await inviteStaff(null, formData);
            }

            if (result?.error) {
                setError(result.error);
                toast.error(result.error);
            } else {
                toast.success(member ? 'Miembro actualizado correctamente' : 'Invitación enviada correctamente');
                setOpen(false);
                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            console.error(err);
            setError('Error de conexión o servidor');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setFullName('');
        setRole('coach');
        setIsActive(true);
        setError(null);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Nuevo Miembro
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {member ? 'Editar Miembro del Equipo' : 'Añadir Nuevo Miembro'}
                    </DialogTitle>
                    <DialogDescription>
                        {member
                            ? 'Actualiza los datos del miembro del equipo.'
                            : 'Selecciona el rol y completa la información.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Rol</Label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                                disabled={loading}
                            >
                                <option value="coach">Coach</option>
                                <option value="closer">Closer</option>
                                <option value="setter">Setter</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading || !!member} // Disabled if editing
                                placeholder="email@ejemplo.com"
                            />
                            {member ? (
                                <p className="text-xs text-yellow-600">
                                    El email no se puede cambiar. Para cambiarlo, desactiva este usuario e invita uno nuevo.
                                </p>
                            ) : (
                                <p className="text-xs text-gray-500">
                                    Se enviará una invitación a este correo.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Nombre Completo *</Label>
                            <Input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                disabled={loading}
                                placeholder="Nombre Apellido"
                            />
                        </div>

                        {member && (
                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    disabled={loading}
                                />
                                <Label htmlFor="isActive" className="font-normal cursor-pointer">
                                    Usuario Activo
                                </Label>
                            </div>
                        )}

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={loading}>
                                {loading
                                    ? (member ? 'Guardando...' : 'Enviando...')
                                    : (member ? 'Guardar Cambios' : 'Enviar Invitación')}
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
