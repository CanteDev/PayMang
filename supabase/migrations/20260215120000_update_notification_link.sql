-- Update notify admin incidence trigger to point to payslips status=incidence
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
            '/admin/payslips?status=incidence'
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;
