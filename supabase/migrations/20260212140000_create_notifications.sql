-- Create Notifications Table
create table if not exists notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    message text not null,
    type text check (type in ('info', 'success', 'warning', 'error')),
    link text,
    is_read boolean default false,
    created_at timestamptz default now()
);

-- Enable RLS
alter table notifications enable row level security;

-- Policy: Users can only see their own notifications
create policy "Users can view own notifications"
    on notifications for select
    using (auth.uid() = user_id);

-- Policy: System functions (security definer) can insert, users can update read status
create policy "Users can update own notifications"
    on notifications for update
    using (auth.uid() = user_id);

-- Helper Function: Notify Admins
create or replace function notify_admins(
    p_title text,
    p_message text,
    p_type text,
    p_link text default null
) returns void as $$
begin
    insert into notifications (user_id, title, message, type, link)
    select id, p_title, p_message, p_type, p_link
    from profiles
    where role = 'admin';
end;
$$ language plpgsql security definer;

-- Trigger 1: Admin - Commission Validated (Pending Payouts)
create or replace function trigger_notify_admin_validated()
returns trigger as $$
begin
    if new.status = 'validated' and (old.status is distinct from 'validated') then
        perform notify_admins(
            'Comisiones Validadas',
            'Tienes comisiones validadas listas para ser pagadas.',
            'info',
            '/admin/payslips'
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_commission_validated
    after update on commissions
    for each row execute function trigger_notify_admin_validated();

-- Trigger 2: Admin - New Incidence
create or replace function trigger_notify_admin_incidence()
returns trigger as $$
declare
    v_agent_name text;
begin
    if new.status = 'incidence' and (old.status is distinct from 'incidence') then
        select full_name into v_agent_name from profiles where id = new.agent_id;
        
        perform notify_admins(
            'Nueva Incidencia',
            '⚠️ ' || coalesce(v_agent_name, 'Agente') || ' ha reportado una incidencia. Revisión requerida.',
            'warning',
            '/admin/incidences'
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_commission_incidence
    after update on commissions
    for each row execute function trigger_notify_admin_incidence();

-- Trigger 3: Agent - New Commission Pending (Coach/Closer/Setter)
create or replace function trigger_notify_agent_new_commission()
returns trigger as $$
begin
    insert into notifications (user_id, title, message, type, link)
    values (
        new.agent_id,
        'Nueva Comisión Pendiente',
        'Se ha generado una nueva comisión pendiente de validación.',
        'info',
        '/' || new.role_at_sale || '/commissions'
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_new_commission
    after insert on commissions
    for each row execute function trigger_notify_agent_new_commission();

-- Trigger 4: Agent - Incidence Resolved
create or replace function trigger_notify_agent_resolved()
returns trigger as $$
begin
    if new.status = 'validated' and old.status = 'incidence' then
        insert into notifications (user_id, title, message, type, link)
        values (
            new.agent_id,
            'Incidencia Resuelta',
            '✅ El Admin ha resuelto tu incidencia. Ya puedes validarla (o ha sido validada).',
            'success',
            '/' || new.role_at_sale || '/commissions'
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_commission_resolved
    after update on commissions
    for each row execute function trigger_notify_agent_resolved();

-- Trigger 5: Coach - New Student Assigned
create or replace function trigger_notify_coach_assigned()
returns trigger as $$
begin
    if new.assigned_coach_id is not null and (old.assigned_coach_id is distinct from new.assigned_coach_id) then
        insert into notifications (user_id, title, message, type, link)
        values (
            new.assigned_coach_id,
            'Nuevo Alumno Asignado',
            '🚀 El alumno ' || new.full_name || ' te ha sido asignado. ¡Inicia el onboarding!',
            'info',
            '/coach'
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_student_assigned
    after update on students
    for each row execute function trigger_notify_coach_assigned();

-- Trigger 6: Closer - Payment Failure (Critical)
-- First, ensure sale_status has 'failed'
alter type sale_status add value if not exists 'failed';
alter type sale_status add value if not exists 'cancelled';

create or replace function trigger_notify_closer_payment_failed()
returns trigger as $$
declare
    v_closer_id uuid;
begin
    if (new.status = 'failed' or new.status = 'cancelled') and (old.status is distinct from new.status) then
        v_closer_id := (new.metadata->>'closer_id')::uuid;
        
        if v_closer_id is not null then
            insert into notifications (user_id, title, message, type, link)
            values (
                v_closer_id,
                'Fallo de Pago (Crítico)',
                '🔴 Pago fallido para venta de ' || (select full_name from students where id = new.student_id limit 1) || '. Seguimiento inmediato requerido.',
                'error',
                '/closer'
            );
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_payment_failed
    after update on sales
    for each row execute function trigger_notify_closer_payment_failed();
