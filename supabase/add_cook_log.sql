-- Ergänzung für das Kurzprofil: nur die Tabelle cook_log.
-- Für Projekte, in denen schema.sql schon vor der Startseite ausgeführt wurde. Kann mehrfach laufen.

create table if not exists public.cook_log (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id    uuid references public.recipes (id) on delete set null,
  recipe_title text not null default '',
  category     text,
  menu_id      uuid references public.menus (id) on delete set null,
  cooked_at    timestamptz not null default now()
);

create index if not exists cook_log_owner_idx on public.cook_log (owner, cooked_at desc);

alter table public.cook_log enable row level security;
drop policy if exists "own rows" on public.cook_log;
create policy "own rows" on public.cook_log for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

grant select, insert, update, delete on public.cook_log to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cook_log'
  ) then
    alter publication supabase_realtime add table public.cook_log;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Kontrolle: sollte eine Zeile mit "cook_log" zeigen.
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'cook_log';
