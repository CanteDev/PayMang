-- Migration: Support Multiple Packs per Student
-- Description: Moves financial fields from `students` to `sales` and links `payments` to `sales`.

BEGIN;

-- 1. Wipe all existing student data, sales, payments, commissions, and links to start fresh
-- per user request: "borrar todos los pagos, comisiones, alumnos"
TRUNCATE TABLE 
    public.payment_links, 
    public.commissions, 
    public.payments, 
    public.sales, 
    public.students,
    public.pack_offers,
    public.packs
CASCADE;

-- 2. Añadir campos financieros a la tabla de ventas (sales)
ALTER TABLE public.sales
ADD COLUMN payment_method text,
ADD COLUMN total_installments integer DEFAULT 1,
ADD COLUMN installment_period integer DEFAULT 1,
ADD COLUMN start_date date;

-- 3. Añadir sale_id a la tabla de pagos (payments)
ALTER TABLE public.payments
ADD COLUMN sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE;

-- 4. Eliminar las columnas financieras viejas de la tabla students
ALTER TABLE public.students 
DROP COLUMN pack_id,
DROP COLUMN agreed_price,
DROP COLUMN payment_method,
DROP COLUMN total_installments,
DROP COLUMN installment_period,
DROP COLUMN start_date;

-- 5. (Opcional en el futuro) Eliminar las columnas viejas de students
-- ALTER TABLE public.students 
-- DROP COLUMN pack_id,
-- DROP COLUMN agreed_price,
-- DROP COLUMN payment_method,
-- DROP COLUMN total_installments,
-- DROP COLUMN installment_period,
-- DROP COLUMN start_date;

COMMIT;
