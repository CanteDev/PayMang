/**
 * Types derivados del esquema de Supabase
 * Generados manualmente basados en 001_initial_schema.sql
 */

import { UserRole, StudentStatus, GatewayType, SaleStatus, CommissionStatus, LinkStatus } from '@/config/app.config';

// Database Tables
export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    payment_details: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Pack {
    id: string;
    name: string;
    price: number;
    gateway_ids: {
        stripe_prod_id?: string;
        hotmart_prod_id?: string;
        sequra_merchant_id?: string;
    };
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Student {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    status: StudentStatus;
    assigned_coach_id: string | null;
    closer_id: string | null;
    setter_id: string | null;
    external_data: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface Sale {
    id: string;
    student_id: string;
    pack_id: string;
    gateway: GatewayType;
    transaction_id: string;
    total_amount: number;
    amount_collected: number;
    status: SaleStatus;
    metadata: {
        closer_id?: string;
        coach_id?: string;
        setter_id?: string;
    };
    sequra_order_ref?: string;
    sequra_payment_status?: {
        initial_70: boolean;
        second_15: boolean;
        final_15: boolean;
    };
    created_at: string;
    updated_at: string;
}

export interface Commission {
    id: string;
    sale_id: string;
    agent_id: string;
    role_at_sale: string;
    amount: number;
    milestone: number;
    status: CommissionStatus;
    incidence_note: string | null;
    created_at: string;
    validated_at: string | null;
    paid_at: string | null;
    updated_at: string;
}

export interface Expense {
    id: string;
    created_at: string;
    start_date: string;
    end_date: string | null;
    concept: string;
    amount: number;
    category: string;
    type: 'fijo' | 'variable';
    recurring: boolean;
    notes: string | null;
    user_id: string | null;
    updated_at?: string; // Optional if not in table or generated
}

export interface PaymentLink {
    id: string; // short code
    created_by: string;
    student_id: string;
    pack_id: string;
    gateway: GatewayType;
    metadata: {
        closer_id: string;
        coach_id: string;
        setter_id?: string;
    };
    status: LinkStatus;
    clicked_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AppSettings {
    key: string;
    value: any;
    category: 'payment' | 'business' | 'system';
    description: string | null;
    encrypted: boolean;
    updated_at: string;
}

// Database type for Supabase client
export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Omit<Profile, 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
            };
            packs: {
                Row: Pack;
                Insert: Omit<Pack, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Pack, 'id' | 'created_at' | 'updated_at'>>;
            };
            students: {
                Row: Student;
                Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Student, 'id' | 'created_at' | 'updated_at'>>;
            };
            sales: {
                Row: Sale;
                Insert: Omit<Sale, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Sale, 'id' | 'created_at' | 'updated_at'>>;
            };
            commissions: {
                Row: Commission;
                Insert: Omit<Commission, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Commission, 'id' | 'created_at' | 'updated_at'>>;
            };
            expenses: {
                Row: Expense;
                Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>;
            };
            payment_links: {
                Row: PaymentLink;
                Insert: Omit<PaymentLink, 'created_at' | 'updated_at'>;
                Update: Partial<Omit<PaymentLink, 'id' | 'created_at' | 'updated_at'>>;
            };
            app_settings: {
                Row: AppSettings;
                Insert: Omit<AppSettings, 'updated_at'>;
                Update: Partial<Omit<AppSettings, 'key'>>;
            };
        };
    };
}

// Extended types for UI (con relaciones)
export interface SaleWithRelations extends Sale {
    student?: Student;
    pack?: Pack;
}

export interface CommissionWithRelations extends Commission {
    sale?: SaleWithRelations;
    agent?: Profile;
}

export interface StudentWithCoach extends Student {
    coach?: Profile;
}

export interface PaymentLinkWithRelations extends PaymentLink {
    student?: Student;
    pack?: Pack;
    creator?: Profile;
}
