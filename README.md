# Essen ist fertig

Wochenplanung, Rezepte und eine gemeinsame Einkaufsliste für die Familie –
als installierbare Web-App (PWA) mit Supabase als Backend.

Gedacht als Ersatz für Bring!, mit dem Teil, der dort fehlt: Der Wochenplan
erzeugt die Einkaufsliste, und die Liste lässt sich nach Supermarkt-Reihenfolge,
nach Geschäft oder nach Rezept sortieren.

## Was die App kann

- **Wochenplan** – Montag bis Sonntag, Mittag und Abend (Frühstück und Snack
  zuschaltbar). Rezept zuweisen, Portionen anpassen, oder Freitext wie „Reste".
- **Rezepte** – eigene Rezepte, Links auf Cookidoo oder Webseiten, Schlagwörter,
  Portionen. Thermomix-Schritte mit Zeit, Temperatur, Stufe, Linkslauf und Varoma.
- **Rezepttext einfügen** – abgetippten oder geteilten Text einfügen; Zeilen wie
  „200 g Mehl" werden als Zutat erkannt, „3 Min./100 °C/Stufe 2" als
  Thermomix-Einstellung.
- **Einkaufsliste erzeugen** – Mengen werden auf die geplanten Portionen
  hochgerechnet, gleiche Zutaten über Rezepte hinweg addiert (200 g + 0,5 kg
  Mehl = 700 g), Vorrätiges vorab abgewählt.
- **Drei Sortierungen** – Supermarkt-Reihenfolge (anpassbar an euren Stammladen),
  nach Geschäft (Supermarkt, Drogerie, Fleischer, Bäcker, Markt), nach Rezept.
- **Offline** – Abhaken funktioniert ohne Empfang; sobald wieder Netz da ist,
  gleicht sich alles ab. Änderungen des anderen Handys erscheinen live.
- **Vorrat** – was immer da ist (Mehl, Salz, Öl), landet nicht jedes Mal auf der Liste.

## Einrichten

### 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
   **Region: Central EU (Frankfurt)** – dann bleiben die Daten in der EU.
2. Im SQL-Editor den Inhalt von `supabase/migrations/0001_init.sql` ausführen.
3. Unter *Authentication → Providers → Email* für einen Zwei-Personen-Haushalt
   die Bestätigungs-E-Mail abschalten („Confirm email" aus). Sonst hängt die
   Anmeldung am Mail-Versand, der im kostenlosen Tarif streng begrenzt ist.
4. Unter *Project Settings → API* `Project URL` und `anon public key` kopieren.

Der `anon key` ist für den Browser gedacht und darf im Frontend stehen – den
Zugriff regelt Row Level Security in der Datenbank, nicht der Schlüssel. Der
`service_role key` gehört dagegen **nie** in die App.

### 2. App starten

```bash
cp .env.example .env.local     # URL und anon key eintragen
npm install
npm run dev
```

Ohne `.env.local` läuft die App im **Lokalmodus**: alles bleibt auf dem Gerät,
nichts wird synchronisiert. Praktisch zum Ausprobieren, bevor das Backend steht.

### 3. Haushalt einrichten

Einer legt beim ersten Start einen Haushalt an und findet unter *Mehr* den
**Einladungscode**. Die anderen registrieren sich und treten mit diesem Code bei.
Ab dann teilen sich alle Mitglieder Rezepte, Wochenplan und Einkaufsliste.

### 4. Auf dem Handy installieren

```bash
npm run build       # Ergebnis liegt in dist/
```

`dist/` bei einem statischen Hoster ablegen (Vercel, Netlify, Cloudflare Pages –
alle mit ausreichendem kostenlosem Kontingent). Wichtig ist nur HTTPS; ohne das
gibt es keinen Service Worker und damit keinen Offline-Betrieb.

Auf dem Handy die Adresse in Chrome öffnen → Menü → **Zum Startbildschirm
hinzufügen**. Danach hat die App ein eigenes Icon und startet im Vollbild.

## Architektur

```
Android-Handy (Chrome)                   Android-Handy (Chrome)
  PWA + Service Worker                     PWA + Service Worker
  IndexedDB (lokaler Stand)                IndexedDB (lokaler Stand)
        │                                          │
        └────────────► Supabase (Frankfurt) ◄───────┘
                       Postgres + Realtime + Auth
                       Row Level Security
```

**Kein eigener Server.** Die App spricht direkt mit Postgres; die Datenbank
setzt über Row Level Security durch, dass jeder nur die Zeilen seines Haushalts
sieht. Das spart Betrieb, Updates und Kosten.

**Lokal zuerst.** Jede Änderung landet sofort in IndexedDB und im UI. Der
Abgleich läuft im Hintergrund und darf jederzeit fehlschlagen – im Supermarkt
mit einem Balken Empfang ist das der Normalfall, nicht die Ausnahme.

**Konfliktregel.** Bei zwei Änderungen derselben Zeile gewinnt der spätere
Zeitstempel. Die Zeilen sind fein genug geschnitten (ein Posten = eine Zeile),
dass gleichzeitiges Abhaken verschiedener Sachen sich nie in die Quere kommt.
Rezepte dagegen werden als ganzes Dokument gespeichert – zwei Leute bearbeiten
praktisch nie gleichzeitig dasselbe Rezept, und der Abgleich wird dadurch
erheblich einfacher.

### Verzeichnisse

| Pfad | Inhalt |
|---|---|
| `src/lib/` | Fachlogik ohne UI: Einheiten, Listen-Erzeugung, Rezept-Parser, Kategorien |
| `src/data/` | IndexedDB, Supabase-Client, Sync-Store, Anmeldung |
| `src/pages/` | Die fünf Bildschirme |
| `supabase/migrations/` | Datenbankschema inklusive Rechte |
| `scripts/` | Icon-Erzeugung und Durchstich-Test |

## Was nicht geht – und warum

**Cookidoo-Rezepte lassen sich nicht automatisch übernehmen.** Die Inhalte sind
lizenziert, es gibt keine offene Schnittstelle, und Auslesen verstößt gegen die
Nutzungsbedingungen. Die App speichert deshalb nur den Link. Die Zutaten trägst
du ein oder fügst sie als Text ein – der Editor ist darauf ausgelegt, dass das
schnell geht.

**Bring! hat keinen Export.** Die Stammdaten müssen einmalig neu angelegt werden.
Bei einer Einkaufsliste erledigt sich das nach ein, zwei Wochen Nutzung von selbst.

**Google Drive taugt nicht als Backend.** Drive ist ein Dateispeicher: kein
Echtzeit-Push ohne eigenen Server, und zwei gleichzeitige Änderungen überschreiben
sich gegenseitig, weil eine Datei nur als Ganzes geschrieben wird. Als Ziel für
ein Backup ist Drive sinnvoll, als Synchronisationsschicht nicht.
Ausführlich in [`docs/infrastruktur.md`](docs/infrastruktur.md).

**Uhrzeiten der Geräte.** Die Konfliktauflösung verlässt sich auf die Uhr des
jeweiligen Handys. Beim Abgleich wird deshalb ein Fenster von zwei Minuten
zurückgelesen. Handys synchronisieren ihre Uhr übers Netz; in der Praxis ist das
unkritisch.

## Später

- **Play Store**: Die PWA lässt sich als Trusted Web Activity (TWA) in ein APK
  wrappen, ohne den Code anzufassen – siehe `docs/infrastruktur.md`.
- **Push**: „Anna hat Milch hinzugefügt" über Web Push; auf Android-Chrome
  zuverlässig, braucht VAPID-Schlüssel und einen Service-Worker-Handler.
- **Rezept-Import per URL** von Seiten mit `schema.org/Recipe`-Daten (Chefkoch &
  Co.). Braucht eine kleine Supabase Edge Function, weil der Browser fremde
  Seiten wegen CORS nicht direkt laden darf.

## Entwicklung

```bash
npm run dev         # Entwicklungsserver
npm run typecheck   # TypeScript prüfen
npm run build       # Produktionsbundle
npm run icons       # PWA-Icons neu erzeugen
```

Durchstich im echten Browser (Rezept → Plan → Liste → Abhaken → Neuladen):

```bash
npm install --no-save playwright && npx playwright install chromium
npm run dev -- --port 5180     # in einem zweiten Terminal
npm run smoke
```

Playwright steht bewusst nicht in den `devDependencies` – für ein Projekt dieser
Größe lohnt der Browser-Download nicht bei jedem `npm install`.
