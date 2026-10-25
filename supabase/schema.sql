-- Kochbuch: Tabellen, Zugriffsregeln (row level security) und Realtime.
-- Im Supabase-Dashboard unter SQL Editor → New query einfügen und auf Run klicken.
-- Das Skript kann mehrfach ausgeführt werden.

create extension if not exists pgcrypto;

-- ---------- Tabellen ----------

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  category    text,
  servings    integer check (servings between 1 and 99),
  total_min   integer check (total_min between 0 and 2880),
  tags        text[] not null default '{}',
  ingredients jsonb not null default '[]'::jsonb,  -- [{qty, unit, name}] oder {section: true, name}
  steps       jsonb not null default '[]'::jsonb,  -- ["Schritt 1", "Schritt 2", ...]
  notes       text not null default '',
  source      text not null default '',
  rating      smallint not null default 0 check (rating between 0 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.recipe_comments (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  text       text not null check (length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.menus (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '',
  date       date,
  guests     integer check (guests between 1 and 99),
  courses    jsonb not null default '[]'::jsonb,   -- [{recipeId, course}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  qty        double precision,
  unit       text not null default '',
  done       boolean not null default false,
  sources    text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Abgehakte Zutaten und Schritte im Kochmodus, je Menü ("m-<id>") oder Rezept ("r-<id>").
create table if not exists public.cook_progress (
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, key)
);

-- Gekochte Gerichte: ein Eintrag je fertig gekochtem Rezept (für das Kurzprofil auf der Startseite).
-- Titel und Kategorie werden mitgespeichert, damit die Zählung auch nach dem Löschen eines Rezepts stimmt.
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
create index if not exists recipes_owner_idx on public.recipes (owner);
create index if not exists recipe_comments_recipe_idx on public.recipe_comments (recipe_id);
create index if not exists menus_owner_idx on public.menus (owner);
create index if not exists shopping_items_owner_idx on public.shopping_items (owner);

-- ---------- Zugriffsregeln: jede Person sieht und ändert nur ihre eigenen Daten ----------

do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_comments', 'menus', 'shopping_items', 'cook_progress', 'cook_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- Kommentare nur an eigenen Rezepten.
drop policy if exists "comment own recipes" on public.recipe_comments;
create policy "comment own recipes" on public.recipe_comments as restrictive for insert to authenticated
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner = auth.uid()));

-- ---------- Zugriff über die Data API ----------
-- Nötig, wenn beim Anlegen des Projekts „Automatically expose new tables“ abgewählt war.
-- Die Zugriffsregeln oben gelten trotzdem: angemeldete Personen sehen nur ihre eigenen Zeilen.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.recipes, public.recipe_comments, public.menus, public.shopping_items, public.cook_progress, public.cook_log
  to authenticated;

-- ---------- Realtime: Änderungen erscheinen sofort auf dem anderen Gerät ----------

do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_comments', 'menus', 'shopping_items', 'cook_progress', 'cook_log'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Die Data API soll die neuen Tabellen sofort kennen.
notify pgrst, 'reload schema';
