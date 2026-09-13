-- Prüfskript: nach dem Einspielen von 0001_init.sql im SQL-Editor ausführen.
--
-- Es verändert nichts, sondern liest nur nach, ob alles angelegt wurde.
-- In der Spalte "status" muss überall "ok" stehen.

with tabellen(name) as (
  values ('households'), ('household_members'), ('recipes'),
         ('plan_entries'), ('pantry_items'), ('shopping_items')
),
funktionen(name) as (
  values ('create_household'), ('join_household'),
         ('my_households'), ('is_household_member')
),
realtime(name) as (
  values ('shopping_items'), ('plan_entries'), ('recipes'), ('pantry_items')
),
ergebnisse as (
  select 1 as nr, 'Tabellen angelegt' as pruefung,
         count(*) || ' von 6' as ergebnis,
         count(*) = 6 as bestanden
  from pg_tables
  where schemaname = 'public' and tablename in (select name from tabellen)

  union all
  select 2, 'Zugriffsschutz (RLS) aktiv',
         count(*) || ' von 6',
         count(*) = 6
  from pg_tables
  where schemaname = 'public'
    and tablename in (select name from tabellen)
    and rowsecurity

  union all
  -- 4 Datentabellen x 4 Regeln + 2 für households + 2 für household_members
  select 3, 'Zugriffsregeln vorhanden',
         count(*) || ' von 20',
         count(*) = 20
  from pg_policies
  where schemaname = 'public' and tablename in (select name from tabellen)

  union all
  select 4, 'Funktionen angelegt',
         count(*) || ' von 4',
         count(*) = 4
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in (select name from funktionen)

  union all
  select 5, 'Live-Aktualisierung eingeschaltet',
         count(*) || ' von 4',
         count(*) = 4
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename in (select name from realtime)

  union all
  -- Ohne diesen Trigger blieben Änderungen für das andere Handy unsichtbar.
  select 6, 'Zeitstempel-Trigger gesetzt',
         count(*) || ' von 5',
         count(*) = 5
  from pg_trigger
  where not tgisinternal and tgname like '%\_touch'

  union all
  select 7, 'Rechte für angemeldete Nutzer',
         count(*) || ' von 6',
         count(*) = 6
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and privilege_type = 'SELECT'
    and table_name in (select name from tabellen)
)
select pruefung,
       ergebnis,
       case when bestanden then 'ok' else 'FEHLT – siehe docs/supabase-einrichten.md' end as status
from ergebnisse
order by nr;
