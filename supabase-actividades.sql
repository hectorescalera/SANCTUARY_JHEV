create table if not exists public.actividades (
    id bigint primary key,
    tipo text not null check (tipo in ('ritual', 'proyecto')),
    nombre text not null,
    fecha date not null,
    notas text default '',
    duracion integer,
    registro_dias jsonb not null default '{}'::jsonb,
    dias_completados integer not null default 0,
    link_live text default '',
    link_repo text default '',
    tareas jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.actividades enable row level security;

drop policy if exists "Actividades visibles para todos" on public.actividades;
drop policy if exists "Actividades creadas por todos" on public.actividades;
drop policy if exists "Actividades actualizadas por todos" on public.actividades;
drop policy if exists "Actividades eliminadas por todos" on public.actividades;

create policy "Actividades visibles para todos"
    on public.actividades for select
    using (true);

create policy "Actividades creadas por todos"
    on public.actividades for insert
    with check (true);

create policy "Actividades actualizadas por todos"
    on public.actividades for update
    using (true)
    with check (true);

create policy "Actividades eliminadas por todos"
    on public.actividades for delete
    using (true);