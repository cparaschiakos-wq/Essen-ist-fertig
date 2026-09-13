-- ACHTUNG: Löscht alle Rezepte, Pläne und Einkaufslisten unwiderruflich.
--
-- Nur nötig, wenn beim Einrichten etwas schiefgegangen ist und 0001_init.sql
-- noch einmal von vorn laufen soll - die Migration legt Tabellen an und
-- scheitert deshalb beim zweiten Durchlauf an "already exists".
--
-- Die Benutzerkonten unter Authentication bleiben erhalten; nur die Zuordnung
-- zum Haushalt ist danach weg, also muss der Haushalt neu angelegt werden.

drop table if exists public.shopping_items cascade;
drop table if exists public.pantry_items cascade;
drop table if exists public.plan_entries cascade;
drop table if exists public.recipes cascade;
drop table if exists public.household_members cascade;
drop table if exists public.households cascade;

drop function if exists public.create_household(text) cascade;
drop function if exists public.join_household(text) cascade;
drop function if exists public.my_households() cascade;
drop function if exists public.is_household_member(uuid) cascade;
drop function if exists public.touch_updated_at() cascade;
