-- Cambiar la vista all_transactions para que use los permisos RLS del usuario que la consulta
-- Esto evita que herede los permisos del administrador (SECURITY DEFINER por defecto)
ALTER VIEW public.all_transactions SET (security_invoker = true);
