'use client';

import { useState } from 'react';
import StudentForm from '@/components/admin/StudentForm';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

interface CreateStudentDialogProps {
    onSuccess?: (student: any) => void;
    trigger?: React.ReactNode;
}

export default function CreateStudentDialog({ onSuccess, trigger }: CreateStudentDialogProps) {
    const [open, setOpen] = useState(false);

    const handleSuccess = (student: any) => {
        setOpen(false);
        if (onSuccess) onSuccess(student);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Nuevo Alumno
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-0 border-0 bg-transparent shadow-none">
                {/* StudentForm handles its own specific dialog content/styles usually, 
                     but here we are wrapping it. 
                     Wait, StudentForm ALREADY renders a DialogTrigger and Dialog. 
                     My previous plan said "Wrapper component... to hold the StudentForm".
                     BUT StudentForm IS a Dialog. 
                     
                     Refinement: StudentForm currently has its own Dialog/Trigger.
                     If I want to trigger it from an external button (like in LinkGenerator), 
                     I should probably expose a way to control it or simply render it.
                     
                     Actually, StudentForm is defined as:
                     return ( <Dialog ...> <DialogTrigger>...</DialogTrigger> ... )
                     
                     So I don't strictly need a wrapper if I just use StudentForm directly.
                     
                     However, for the specific "+" button in LinkGenerator, I want a custom Trigger.
                     StudentForm has a hardcoded Trigger button.
                     
                     I will modify StudentForm to accept a `customTrigger` prop. 
                     Then I don't need this wrapper file at all, or this wrapper just simplifies usage.
                     
                     Let's check StudentForm content again.
                 */}
            </DialogContent>
        </Dialog>
    );
}
