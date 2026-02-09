-- PayMang Database Schema
-- Versión: 1.0.0
-- Descripción: Esquema completo para el sistema de gestión de comisiones

-- ============================================
-- 1. ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'closer', 'coach', 'setter');
CREATE TYPE student_status AS ENUM ('active', 'finished', 'defaulted');
CREATE TYPE gateway_type AS ENUM ('stripe', 'hotmart', 'sequra');
CREATE TYPE sale_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE commission_status AS ENUM ('pending', 'incidence', 'validated', 'paid');
CREATE TYPE link_status AS ENUM ('pending', 'clicked', 'paid', 'deleted');

-- ============================================
-- 2. TABLAS MAESTRAS
-- ============================================

-- 2.1 PROFILES (extiende auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'setter',
  payment_details TEXT, -- IBAN o PayPal
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_active ON profiles(is_active);

-- 2.2 PACKS (Productos)
CREATE TABLE packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  gateway_ids JSONB NOT NULL DEFAULT '{}'::jsonb, -- { stripe_prod_id, hotmart_prod_id, sequra_merchant_id }
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para packs
CREATE INDEX idx_packs_active ON packs(is_active);

-- 2.3 STUDENTS (Alumnos/Clientes)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE, -- CRITICAL: Identificador único
  full_name TEXT NOT NULL,
  phone TEXT,
  status student_status NOT NULL DEFAULT 'active',
  assigned_coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  external_data JSONB DEFAULT '{}'::jsonb, -- Datos adicionales de pasarelas
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para students
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_coach ON students(assigned_coach_id);
CREATE INDEX idx_students_status ON students(status);

-- 2.4 SALES (Transacciones)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE RESTRICT,
  gateway gateway_type NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE, -- ID de la pasarela
  total_amount DECIMAL(10, 2) NOT NULL,
  amount_collected DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Para pagos parciales (seQura)
  status sale_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- { closer_id, coach_id, setter_id }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sales
CREATE INDEX idx_sales_student ON sales(student_id);
CREATE INDEX idx_sales_pack ON sales(pack_id);
CREATE INDEX idx_sales_gateway ON sales(gateway);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_transaction ON sales(transaction_id);

-- 2.5 COMMISSIONS (Libro contable)
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role_at_sale TEXT NOT NULL, -- 'coach', 'closer', 'setter'
  amount DECIMAL(10, 2) NOT NULL,
  milestone INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3 (para seQura)
  status commission_status NOT NULL DEFAULT 'pending',
  incidence_note TEXT, -- Nota cuando hay incidencia
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para commissions
CREATE INDEX idx_commissions_sale ON commissions(sale_id);
CREATE INDEX idx_commissions_agent ON commissions(agent_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_paid_at ON commissions(paid_at);

-- 2.6 EXPENSES (Gastos para Cash Flow)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE, -- Nullable para gastos únicos
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para expenses
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_dates ON expenses(start_date, end_date);

-- 2.7 PAYMENT_LINKS (Smart Redirect URLs)
CREATE TABLE payment_links (
  id TEXT PRIMARY KEY, -- Short code (ej: 'Kj82xM')
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE RESTRICT,
  gateway gateway_type NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- { closer_id, coach_id, setter_id }
  status link_status NOT NULL DEFAULT 'pending',
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para payment_links
CREATE INDEX idx_payment_links_creator ON payment_links(created_by);
CREATE INDEX idx_payment_links_status ON payment_links(status);
CREATE INDEX idx_payment_links_student ON payment_links(student_id);

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- ========== PROFILES ==========
-- Todos pueden ver perfiles activos, pero solo pueden editar el suyo o Admin puede editar todos
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ========== PACKS ==========
-- Admin: CRUD completo
-- Otros roles: Solo lectura de packs activos
CREATE POLICY "packs_select_active" ON packs
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "packs_all_admin" ON packs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ========== STUDENTS ==========
-- Admin: CRUD completo
-- Closer: Lectura de todos
-- Coach: Solo sus alumnos asignados
-- Setter: No accede
CREATE POLICY "students_select_admin" ON students
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "students_select_closer" ON students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'closer'
    )
  );

CREATE POLICY "students_select_coach" ON students
  FOR SELECT
  USING (
    assigned_coach_id = auth.uid()
  );

-- ========== SALES ==========
-- Admin: CRUD completo
-- Otros: Solo ven sus propias ventas (donde aparecen en metadata)
CREATE POLICY "sales_all_admin" ON sales
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "sales_select_own" ON sales
  FOR SELECT
  USING (
    metadata->>'closer_id' = auth.uid()::text
    OR metadata->>'coach_id' = auth.uid()::text
    OR metadata->>'setter_id' = auth.uid()::text
  );

-- ========== COMMISSIONS ==========
-- Admin: CRUD completo
-- Otros: Solo ven y editan sus propias comisiones
CREATE POLICY "commissions_all_admin" ON commissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "commissions_select_own" ON commissions
  FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "commissions_update_own" ON commissions
  FOR UPDATE
  USING (agent_id = auth.uid());

-- ========== EXPENSES ==========
-- Solo Admin puede gestionar gastos
CREATE POLICY "expenses_all_admin" ON expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ========== PAYMENT_LINKS ==========
-- Admin: CRUD completo
-- Closer: Solo sus propios links
CREATE POLICY "payment_links_all_admin" ON payment_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "payment_links_own" ON payment_links
  FOR ALL
  USING (created_by = auth.uid());

-- ============================================
-- 4. FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packs_updated_at BEFORE UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON payment_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. DATOS INICIALES (SEED)
-- ============================================

-- Se agregarán después del setup de autenticación
