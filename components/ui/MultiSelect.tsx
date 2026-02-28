'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface MultiSelectProps {
    options: { label: string; value: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = 'Seleccionar...',
    className,
    icon,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item));
    };

    const handleSelect = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((s) => s !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        'min-h-[2.25rem] h-auto w-full justify-between bg-white hover:bg-white border-gray-200 font-normal',
                        className
                    )}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {icon && <div className="text-gray-500 shrink-0">{icon}</div>}
                        <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                            {selected.length > 0 ? (
                                <>
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1 font-normal bg-slate-100 hover:bg-slate-200 text-slate-900 border-none"
                                    >
                                        {options.find((o) => o.value === selected[0])?.label}
                                    </Badge>
                                    {selected.length > 1 && (
                                        <Badge
                                            variant="secondary"
                                            className="rounded-sm px-1 font-normal bg-slate-100 hover:bg-slate-200 text-slate-900 border-none"
                                        >
                                            +{selected.length - 1} más
                                        </Badge>
                                    )}
                                </>
                            ) : (
                                <span className="text-gray-500 truncate">{placeholder}</span>
                            )}
                        </div>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <div className="flex flex-col">
                    <div className="flex items-center border-b px-3 py-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length === 0 && (
                            <div className="py-6 text-center text-sm text-gray-500">
                                No se encontraron resultados.
                            </div>
                        )}
                        {filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                className={cn(
                                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 transition-colors',
                                    selected.includes(option.value) && 'bg-slate-50'
                                )}
                                onClick={() => handleSelect(option.value)}
                            >
                                <Checkbox
                                    checked={selected.includes(option.value)}
                                    onCheckedChange={() => handleSelect(option.value)}
                                    className="mr-2 h-4 w-4"
                                />
                                <span>{option.label}</span>
                            </div>
                        ))}
                    </div>
                    {selected.length > 0 && (
                        <div className="border-t p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-center text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => onChange([])}
                            >
                                Limpiar selección
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
