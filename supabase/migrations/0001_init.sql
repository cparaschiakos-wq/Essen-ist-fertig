-- Essen ist fertig - Grundschema
--
-- Datenmodell in einem Satz: Ein Haushalt hat Mitglieder, Rezepte, einen
-- Wochenplan, einen Vorrat und eine Einkaufsliste. Alles hängt an
-- household_id, und Row Level Security lässt nur Mitglieder an diese Zeilen.
-- Deshalb braucht die App keinen eigenen Server - der Client spricht direkt
-- mit Postgres, und die Datenbank setzt die Rechte durch.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- Haushalt

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Unser Haushalt',
  -- Reihenfolge der Warengruppen = Laufweg durch den Stammsupermarkt.
  category_order text[] not null default array[
    'obst_gemuese','backwaren','molkerei','fleisch_fisch','trocken','konserven',
    'tiefkuehl','getraenke','suesses','drogerie','haushalt','sonstiges'
  ],
  -- Kurzer Code zum Beitreten, damit man niemanden per E-Mail einladen muss.
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- SECURITY DEFINER, weil die Mitgliedsprüfung sonst die RLS-Policy auf
-- household_members selbst auslösen und sich endlos aufrufen würde.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------- Rezepte

-- Zutaten und Schritte liegen als JSONB in der Rezeptzeile: ein Rezept ist ein
-- Dokument, das immer am Stück gespeichert wird. Zwei Leute bearbeiten
-- praktisch nie gleichzeitig dasselbe Rezept, dafür wird der Abgleich trivial.
create table public.recipes (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  servings integer not null default 4 check (servings > 0),
  source text not null default 'eigen' check (source in ('eigen','cookidoo','web')),
  source_url text,
  prep_minutes integer,
  total_minutes integer,
  is_thermomix boolean not null default false,
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  -- Soft Delete: eine harte Löschung käme beim nächsten Abgleich des anderen
  -- Geräts wieder zurück, weil dort die Zeile noch im Cache liegt.
  deleted_at timestamptz
);

-- --------------------------------------------------------------- Wochenplan

create table public.plan_entries (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('fruehstueck','mittag','abend','snack')),
  -- Kein Fremdschlüssel auf recipes: ein gelöschtes Rezept soll den Wochenplan
  -- nicht mit wegreißen, die App zeigt dann den gemerkten Titel.
  recipe_id uuid,
  custom_title text,
  servings integer not null default 4 check (servings > 0),
  note text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index plan_entries_household_date_idx on public.plan_entries (household_id, date);

-- ------------------------------------------------------------------ Vorrat

create table public.pantry_items (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'sonstiges',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ----------------------------------------------------------- Einkaufsliste

-- Eine Zeile pro Posten - fein genug, dass zwei Leute gleichzeitig
-- unterschiedliche Sachen abhaken können, ohne sich zu überschreiben.
create table public.shopping_items (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text not null default 'sonstiges',
  store_type text not null default 'supermarkt',
  is_checked boolean not null default false,
  checked_at timestamptz,
  source text not null default 'manual' check (source in ('manual','plan')),
  recipe_id uuid,
  recipe_title text,
  note text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shopping_items_household_idx on public.shopping_items (household_id, updated_at);

-- --------------------------------------------------------------------- RLS

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.recipes enable row level security;
alter table public.plan_entries enable row level security;
alter table public.pantry_items enable row level security;
alter table public.shopping_items enable row level security;

create policy "Mitglieder sehen ihren Haushalt"
  on public.households for select
  using (public.is_household_member(id));

create policy "Mitglieder ändern ihren Haushalt"
  on public.households for update
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

create policy "Mitglieder sehen die Mitgliederliste"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "Man kann sich selbst entfernen"
  on public.household_members for delete
  using (user_id = auth.uid());

-- Für die vier Datentabellen gilt überall dieselbe Regel: wer im Haushalt ist,
-- darf lesen und schreiben.
do $$
declare
  t text;
begin
  foreach t in array array['recipes','plan_entries','pantry_items','shopping_items'] loop
    execute format(
      'create policy "Mitglieder lesen %1$s" on public.%1$I for select using (public.is_household_member(household_id));',
      t
    );
    execute format(
      'create policy "Mitglieder schreiben %1$s" on public.%1$I for insert with check (public.is_household_member(household_id));',
      t
    );
    execute format(
      'create policy "Mitglieder aktualisieren %1$s" on public.%1$I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));',
      t
    );
    execute format(
      'create policy "Mitglieder löschen %1$s" on public.%1$I for delete using (public.is_household_member(household_id));',
      t
    );
  end loop;
end $$;

-- ------------------------------------------------------- Haushalt anlegen

-- Anlegen und Beitreten laufen über Funktionen, weil beides Zeilen schreibt,
-- für die man noch kein Mitglied ist - die RLS-Policy würde das sonst blocken.
create or replace function public.create_household(household_name text default 'Unser Haushalt')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.households;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.households (name) values (household_name) returning * into created;
  insert into public.household_members (household_id, user_id) values (created.id, auth.uid());
  return created;
end $$;

create or replace function public.join_household(code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.households;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into target from public.households where invite_code = upper(trim(code));
  if target.id is null then
    raise exception 'Unbekannter Einladungscode';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target.id, auth.uid())
  on conflict do nothing;

  return target;
end $$;

create or replace function public.my_households()
returns setof public.households
language sql
security definer
stable
set search_path = public
as $$
  select h.* from public.households h
  join public.household_members m on m.household_id = h.id
  where m.user_id = auth.uid();
$$;

-- ---------------------------------------------------- updated_at absichern

-- Der Client setzt updated_at selbst (er entscheidet damit, welche Version bei
-- einem Konflikt gewinnt). Die Datenbank füllt nur nach, wenn nichts kommt.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.updated_at is null then
      new.updated_at := now();
    end if;
  -- Bei einem Update ohne eigenen Zeitstempel nachziehen, sonst bliebe die
  -- Zeile für den nächsten Abgleich der anderen Geräte unsichtbar.
  elsif new.updated_at is null or new.updated_at = old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['recipes','plan_entries','pantry_items','shopping_items','households'] loop
    execute format(
      'create trigger %1$s_touch before insert or update on public.%1$I for each row execute function public.touch_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- Realtime

-- Damit ein Haken auf dem einen Handy sofort auf dem anderen erscheint.
alter publication supabase_realtime add table public.shopping_items;
alter publication supabase_realtime add table public.plan_entries;
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.pantry_items;

-- ----------------------------------------------------------------- Rechte

-- Supabase vergibt diese Rechte bei neuen Tabellen normalerweise automatisch.
-- Explizit, damit die Migration auch außerhalb eines frischen Projekts (z.B.
-- auf einem selbst gehosteten Postgres) vollständig ist. Der Zugriff selbst
-- wird davon nicht weiter geöffnet - darüber entscheidet weiterhin RLS.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.households, public.household_members, public.recipes,
  public.plan_entries, public.pantry_items, public.shopping_items
  to authenticated;
grant execute on function
  public.create_household(text), public.join_household(text),
  public.my_households(), public.is_household_member(uuid)
  to authenticated;
