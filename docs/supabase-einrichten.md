# Supabase einrichten – Schritt für Schritt

Dauer: etwa 15 Minuten. Danach laufen Rezepte, Wochenplan und Einkaufsliste
synchron auf beiden Handys.

Du brauchst: eine E-Mail-Adresse und ein GitHub-Konto. Einen lokalen
Projektordner, Node.js oder ein Terminal brauchst du **nicht** – der Hoster baut
die App direkt aus GitHub (Schritt 6).

---

## Schritt 1 – Projekt anlegen

1. [supabase.com](https://supabase.com) öffnen und auf **Start your project**
   klicken. Anmelden mit GitHub oder E-Mail.
2. Im Dashboard auf **New project**.
3. Ausfüllen:
   - **Name:** `essen-ist-fertig`
   - **Database Password:** auf *Generate a password* klicken und das Passwort
     **im Passwortmanager speichern**. Die App braucht es nicht, aber ohne das
     Passwort kommst du später nicht an eine Sicherung deiner Daten.
   - **Region:** `Central EU (Frankfurt)` ← **wichtig, lässt sich später nicht
     mehr ändern.** Damit bleiben eure Daten in der EU.
   - **Plan:** Free
4. **Create new project**. Das Anlegen dauert ein bis zwei Minuten.

---

## Schritt 2 – Datenbank einrichten

1. In der linken Leiste auf **SQL Editor**.
2. Auf **New query**.
3. Die Datei `supabase/migrations/0001_init.sql` **öffnen** – etwa mit
   `cat supabase/migrations/0001_init.sql` oder im Editor – und **den Text
   darin** kopieren.
4. Diesen Text in das Eingabefeld einfügen und auf **Run** klicken
   (oder `Strg`+`Enter`, auf dem Mac `Cmd`+`Enter`).

> **Nicht den Dateinamen einfügen.** Der SQL-Editor erwartet SQL-Befehle, keinen
> Pfad. Steht `supabase/migrations/0001_init.sql` im Editor, antwortet Postgres
> mit `syntax error at or near "supabase"`.

Erwartete Meldung: **Success. No rows returned.**

Damit sind die Tabellen, die Zugriffsregeln und die Live-Aktualisierung
eingerichtet.

---

## Schritt 3 – Nachsehen, ob alles sitzt

Nicht überspringen: Wenn hier etwas fehlt, merkst du es sonst erst, wenn die
App sich seltsam verhält.

1. Wieder **New query**.
2. Den **Text aus** `supabase/pruefung.sql` einfügen und **Run**.

Es kommen sieben Zeilen zurück, und in der Spalte `status` muss überall `ok`
stehen:

| pruefung | ergebnis | status |
|---|---|---|
| Tabellen angelegt | 6 von 6 | ok |
| Zugriffsschutz (RLS) aktiv | 6 von 6 | ok |
| Zugriffsregeln vorhanden | 20 von 20 | ok |
| Funktionen angelegt | 4 von 4 | ok |
| Live-Aktualisierung eingeschaltet | 4 von 4 | ok |
| Zeitstempel-Trigger gesetzt | 5 von 5 | ok |
| Rechte für angemeldete Nutzer | 6 von 6 | ok |

**Steht irgendwo `FEHLT`?** Dann `supabase/zuruecksetzen.sql` ausführen und
Schritt 2 wiederholen. Das Rücksetz-Skript löscht alle Daten – zu diesem
Zeitpunkt gibt es noch keine, später ist es das letzte Mittel.

---

## Schritt 4 – Anmeldung ohne Bestätigungs-E-Mail

1. Linke Leiste: **Authentication** → **Sign In / Providers**
   (je nach Stand der Oberfläche heißt der Punkt nur **Providers**).
2. Den Eintrag **Email** aufklappen.
3. **Confirm email** ausschalten.
4. **Save**.

Warum: Im kostenlosen Tarif ist der Mail-Versand streng begrenzt (wenige
Mails pro Stunde). Bei zwei Konten, die einmalig angelegt werden, bringt die
Bestätigung nichts außer der Gefahr, dass die Registrierung am Mail-Versand
hängen bleibt. In Schritt 9 wird die Registrierung stattdessen ganz
abgeschaltet – das schützt wirksamer.

---

## Schritt 5 – Zugangsdaten kopieren

1. Unten links auf **Project Settings** (Zahnrad) → **API**.
2. Zwei Werte kopieren:
   - **Project URL** – nur die Basis-Adresse, `https://abcdefgh.supabase.co`.
     **Ohne Pfad.** An manchen Stellen im Dashboard steht die fertige
     REST-Adresse `https://abcdefgh.supabase.co/rest/v1/` – die ist hier falsch,
     denn den Pfad hängt die App selbst an. (Die App kürzt das inzwischen
     selbst und schreibt eine Warnung in die Browser-Konsole.)
   - **anon public** – ein sehr langer Schlüssel. In neueren Projekten heißt
     der Abschnitt **Legacy API keys**, oder es gibt zusätzlich einen
     *publishable key*; beide funktionieren.

**Den `service_role`-Schlüssel niemals verwenden.** Er umgeht sämtliche
Zugriffsregeln und darf weder in die App noch ins Repository.

Der `anon`-Schlüssel dagegen ist für den Browser gedacht und darf dort stehen:
Wer damit anfragt, kommt trotzdem nur an die Zeilen seines eigenen Haushalts,
weil die Datenbank das durchsetzt – nicht der Schlüssel.

---

## Schritt 6 – App veröffentlichen

Der Hoster baut die App direkt aus GitHub. Kein lokaler Ordner, kein Terminal.

1. [dash.cloudflare.com](https://dash.cloudflare.com) öffnen, kostenloses Konto
   anlegen.
2. **Workers & Pages** → **Create** → Reiter **Pages** → **Connect to Git**.
3. GitHub verbinden, Repository **Essen-ist-fertig** auswählen.
4. Build-Einstellungen:

   | Feld | Wert |
   |---|---|
   | Production branch | `main` |
   | Framework preset | Vite (oder *None*) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

5. **Environment variables** aufklappen und die beiden Werte aus Schritt 5
   eintragen – sie ersetzen hier die Datei `.env.local`:

   | Variable name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | die Project URL, ohne `/rest/v1/` |
   | `VITE_SUPABASE_ANON_KEY` | der anon public key |

6. **Save and Deploy**. Der erste Bau dauert ein bis zwei Minuten.

Am Ende steht dort eine Adresse wie `essen-ist-fertig.pages.dev`. Jeder weitere
Push auf `main` baut automatisch neu.

`public/_redirects` sorgt dafür, dass auch der direkte Aufruf von `/liste` oder
`/rezepte` funktioniert; ohne diese Weiterleitung antwortet ein statischer
Hoster dort mit 404.

### Alternative: lokal entwickeln

Nur nötig, wenn du am Code arbeiten willst. Dann Node.js 22 und Git
installieren, das Repository klonen und im Projektordner:

```bash
cp .env.example .env.local   # beide Werte eintragen
npm install
npm run dev
```

> `.env.local` wird nur beim Start gelesen – lief der Server schon, neu starten.
> Die Datei ist von der Versionsverwaltung ausgenommen und landet nicht auf GitHub.

---

## Schritt 7 – Dein Konto und den Haushalt anlegen

1. Eure neue Adresse (`…pages.dev`) im Browser öffnen.
2. **Registrieren** – E-Mail und ein Passwort mit mindestens 8 Zeichen.
3. Danach kommt der Bildschirm *Haushalt einrichten*. Einen Namen eingeben und
   auf **Neuen Haushalt anlegen**.
4. Oben muss jetzt **Synchron** stehen (grüner Punkt). Steht dort *Nur auf
   diesem Gerät*, siehe Fehlerbehebung unten.

---

## Schritt 8 – Deine Frau einladen

1. Bei dir: unten auf **Mehr** → der **Einladungscode** steht dort
   (acht Zeichen, z.B. `8BD780D0`). Über **Kopieren** weitergeben.
2. Bei ihr: dieselbe Adresse öffnen, **registrieren**, dann auf dem Bildschirm
   *Haushalt einrichten* den Code bei **Einladungscode** eingeben und auf
   **Bestehendem Haushalt beitreten**.

Ab jetzt sehen beide dieselben Rezepte, denselben Plan und dieselbe Liste.
Zum Ausprobieren: auf einem Gerät etwas auf die Liste setzen – es erscheint
innerhalb einer Sekunde auf dem anderen.

---

## Schritt 9 – Registrierung abschalten

Erst machen, wenn ihr beide angemeldet seid.

1. **Authentication** → **Sign In / Providers**.
2. **Allow new users to sign up** ausschalten → **Save**.

Warum: Ohne Mail-Bestätigung (Schritt 4) könnte sonst jeder, der die Adresse
eurer App kennt, ein Konto in eurem Projekt anlegen. An eure Daten käme er
nicht heran, aber er könnte euer Kontingent verbrauchen. Nach dem Abschalten
funktionieren eure bestehenden Konten normal weiter.

Braucht später doch jemand Zugang (Kinder, Großeltern), schaltest du die
Registrierung kurz wieder ein und danach wieder aus.

---

## Schritt 10 – Auf die Handys bringen

Auf **beiden** Handys jeweils einmal:

1. Die `…pages.dev`-Adresse in **Chrome** öffnen.
2. Menü (drei Punkte) → **Zum Startbildschirm hinzufügen**.

Danach hat die App ein eigenes Icon, startet im Vollbild ohne Browser-Leiste
und funktioniert im Supermarkt auch ohne Empfang.

Probe aufs Exempel: Flugmodus an, etwas abhaken, Flugmodus aus – der Haken
wandert zum anderen Handy.

---

## Fehlerbehebung

| Symptom | Ursache und Abhilfe |
|---|---|
| Anfragen laufen ins Leere, Adressen enthalten `/rest/v1/rest/v1` | In `VITE_SUPABASE_URL` steht die REST-Adresse statt der Basis-Adresse. Alles ab `/rest/v1` streichen. |
| App zeigt oben **„Nur auf diesem Gerät"** | Die beiden Variablen fehlen oder sind falsch geschrieben. Sie müssen genau `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` heißen – beim Hoster unter *Environment variables*, lokal in `.env.local`. Beim Hoster danach **Retry deployment**, lokal den Dev-Server neu starten: beides liest die Werte nur beim Bauen bzw. beim Start. |
| **`syntax error at or near "supabase"`** | Im Editor steht der Dateiname statt des Dateiinhalts. Die Datei öffnen (`cat supabase/migrations/0001_init.sql`), den Text darin kopieren, das Eingabefeld leeren und den Text einfügen. |
| **`relation "households" already exists`** beim Ausführen der Migration | Die Migration lief schon einmal. `supabase/pruefung.sql` ausführen; steht überall `ok`, ist alles in Ordnung und du kannst weitermachen. |
| Anmeldung meldet **„Email not confirmed"** | Schritt 4 wurde übersprungen. Nachholen, dann erneut anmelden. |
| **„Unbekannter Einladungscode"** | Der Code hat acht Zeichen; Groß- und Kleinschreibung sind egal. Bei dir unter *Mehr* nachsehen und neu kopieren. |
| Oben steht **„Sync-Fehler"**, darunter *permission denied* | Die Zugriffsregeln fehlen. `supabase/pruefung.sql` ausführen und der Anweisung bei `FEHLT` folgen. |
| Direkter Aufruf von `/liste` ergibt 404 | `public/_redirects` fehlt im Build oder der Hoster wertet die Datei nicht aus. Bei Vercel wird stattdessen eine `vercel.json` mit einer Rewrite-Regel auf `/index.html` gebraucht. |
| Nach dem Urlaub lädt nichts mehr | Kostenlose Projekte werden nach etwa einer Woche ohne Zugriff pausiert. Im Supabase-Dashboard auf **Restore project**, nach ein paar Minuten läuft alles weiter. Die Daten bleiben erhalten. |
| Liste erscheint auf dem anderen Handy nicht | Prüfen, ob die Zeile *Live-Aktualisierung eingeschaltet* im Prüfskript `ok` meldet. Ansonsten hilft meist, die App kurz zu schließen und wieder zu öffnen – beim Wechsel in den Vordergrund wird abgeglichen. |

---

## Sicherung

Im kostenlosen Tarif gibt es keine automatischen Sicherungen. Wenn nach einigen
Monaten genug Rezepte zusammengekommen sind, lohnt ein Export: **Project
Settings → Database → Connection string** liefert die Zugangsdaten für

```bash
pg_dump "<connection string>" > sicherung.sql
```

Dafür brauchst du das Datenbank-Passwort aus Schritt 1.
