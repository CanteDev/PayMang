# PayMang 🚀

Sistema de gestión de ventas high-ticket con comisiones automatizadas.

## 📋 Características

- **Gestión de Ventas**: Integración con Stripe, Hotmart y seQura
- **Comisiones Automatizadas**: Cálculo automático de comisiones por rol (Coach 10%, Closer 8%, Setter 1%)
- **Smart Redirect Links**: URLs cortas para atribución de ventas
- **seQura 70/15/15**: Soporte para pagos parciales con hitos
- **Roles y Permisos**: Admin, Closer, Coach, Setter con RLS
- **Payslips en PDF**: Generación automática de liquidaciones

## 🛠 Stack Tecnológico

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS + Shadcn/UI (macOS Tahoe inspired)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **State**: TanStack Query + Zustand
- **Charts**: Recharts

## 🚀 Setup Local

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd PayMang
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Config urar Supabase

Sigue la guía en `SUPABASE_SETUP.md` para:
- Crear el proyecto en Supabase
- Ejecutar las migraciones
- Crear el usuario admin inicial

### 4. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase.

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 📁 Estructura del Proyecto

```
PayMang/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rutas de autenticación
│   ├── (dashboard)/       # Rutas protegidas por rol
│   └── api/               # API Routes (webhooks, cron)
├── components/            # Componentes React
│   ├── ui/               # Shadcn/UI components
│   ├── forms/            # Formularios
│   └── dashboard/        # Componentes de dashboard
├── lib/                   # Lógica de negocio
│   ├── supabase/         # Clientes de Supabase
│   ├── commissions/      # Calculadora de comisiones
│   └── gateways/         # Integraciones de pasarelas
├── types/                 # Tipos TypeScript
├── config/                # Configuración central
└── supabase/             # Migraciones SQL
    └── migrations/
```

## 👥 Roles y Permisos

| Rol | Acceso |
|-----|--------|
| **Admin** | CRUD total en todas las tablas |
| **Closer** | Generar links, ver alumnos, validar comisiones propias |
| **Coach** | Ver alumnos asignados, validar comisiones propias |
| **Setter** | Ver comisiones propias (sin PII de alumnos) |

## 🔐 Seguridad

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Políticas estrictas por rol
- ✅ Middleware de autenticación
- ✅ Variables de entorno para credenciales

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## 📦 Deploy en Vercel

1. Push a GitHub
2. Importa el proyecto en Vercel
3. Configura las variables de entorno
4. Deploy automático

## 📄 Licencia

Propietaria - © 2026 PayMang

---

**Documentación extendida**: Ver `SUPABASE_SETUP.md` y `/docs`
