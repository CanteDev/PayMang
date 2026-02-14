-- Drop table if exists to ensure schema consistency
drop table if exists public.expenses;

-- Create expenses table
create table public.expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  date date not null,
  concept text not null,
  amount numeric(10, 2) not null,
  category text not null,
  type text not null check (type in ('fijo', 'variable')),
  recurring boolean default false,
  notes text,
  user_id uuid references auth.users(id)
);

-- Enable RLS
alter table public.expenses enable row level security;

-- Policies
create policy "Admins can manage expenses" on public.expenses 
for all 
to authenticated
using (
  auth.uid() in (select id from public.profiles where role = 'admin')
)
with check (
  auth.uid() in (select id from public.profiles where role = 'admin')
);
