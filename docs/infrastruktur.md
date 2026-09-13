# Infrastruktur: Was braucht die App unter Android?

Die kurze Antwort: **erstaunlich wenig.** Kein eigener Server, kein Play Store,
realistisch 0 € laufende Kosten.

## Warum nicht Google Drive

Drive ist ein *Dateispeicher*, keine Datenbank. Für eine gemeinsame
Einkaufsliste scheitert das an drei Stellen:

1. **Keine Echtzeit-Benachrichtigung an den Client.** Die Push-Funktion der
   Drive-API schickt Änderungen an einen öffentlich erreichbaren Webhook – also
   an einen Server, den man dann doch betreiben müsste. Ohne den bleibt nur
   regelmäßiges Nachfragen: Verzögerung, Akkuverbrauch, API-Kontingent.

2. **Verlorene Änderungen.** Eine Datei wird immer als Ganzes geschrieben. Wenn
   du im Supermarkt Haken setzt und deine Frau gleichzeitig etwas hinzufügt,
   überschreibt die zweite gespeicherte Version die erste vollständig. Genau
   dieses Zusammenführen auf Feld-Ebene braucht eine geteilte Liste aber.

3. **Aufwendige Freigabe.** Der volle `drive`-Zugriff ist bei Google ein
   „restricted scope" mit Sicherheitsprüfung. Mit `drive.file` umgeht man das,
   ist dann aber auf selbst erzeugte Dateien beschränkt.

**Sinnvoll ist Drive als Backup-Ziel** – ein nächtlicher JSON-Export des
Haushalts. Als Synchronisationsschicht nicht.

## Die gewählte Architektur

```
Android-Handy (Chrome)                   Android-Handy (Chrome)
  PWA + Service Worker                     PWA + Service Worker
  IndexedDB (lokaler Stand)                IndexedDB (lokaler Stand)
        │                                          │
        └────────────► Supabase (Frankfurt) ◄───────┘
                       Postgres + Realtime + Auth
                       Row Level Security
```

### Backend: Supabase

Postgres mit Echtzeit-Verteilung, Anmeldung und Zugriffsregeln in einem, Region
Frankfurt. Ausschlaggebend:

- **Kein eigener Server.** Row Level Security setzt in der Datenbank durch, dass
  nur Haushaltsmitglieder an ihre Zeilen kommen. Die App spricht direkt mit
  Postgres.
- **Kein Lock-in.** Es ist gewöhnliches Postgres. Falls Supabase irgendwann
  nicht mehr passt, zieht ein `pg_dump` auf jeden anderen Anbieter oder den
  eigenen Server um.
- **Relationales Datenmodell.** Rezept → Zutaten → Wochenplan → Einkaufsliste
  ist genau das, wofür SQL gebaut ist.

*Alternative Firebase/Firestore:* technisch ebenfalls tauglich, mit sehr guter
Offline-Unterstützung. Dafür NoSQL-Datenmodell und stärkere Bindung an Google.

### Auslieferung: PWA statt nativer App

- Kein Play Store, keine Entwicklergebühr, kein Signieren, keine Freigabeprüfung.
- Updates sind sofort bei allen da, ohne Store-Rollout.
- Offline im Supermarkt über Service Worker und IndexedDB.
- Installation über „Zum Startbildschirm hinzufügen" – danach eigenes Icon und
  Vollbild, vom Rest des Systems nicht zu unterscheiden.

Das Frontend (`dist/` nach `npm run build`) ist reines HTML/JS/CSS und läuft bei
jedem statischen Hoster. Voraussetzung ist HTTPS – ohne das kein Service Worker
und damit kein Offline-Betrieb.

## Kosten

| Posten | Kosten |
|---|---|
| Supabase Free Tier | 0 € |
| Hosting (Vercel / Netlify / Cloudflare Pages) | 0 € |
| Eigene Domain (optional) | ~10 €/Jahr |
| Play-Store-Konto (nur bei TWA, optional) | einmalig ~25 € |

Zwei Hinweise zum kostenlosen Supabase-Tarif: Projekte werden nach etwa einer
Woche ohne Zugriff pausiert (bei täglicher Nutzung irrelevant, nach einem langen
Urlaub einmal im Dashboard wieder starten), und der Mail-Versand für
Registrierungen ist streng begrenzt – deshalb die Empfehlung im README, die
Mail-Bestätigung für einen Zwei-Personen-Haushalt abzuschalten.

## Später: APK im Play Store

Falls ihr die App doch als echtes APK wollt, wird die bestehende PWA in eine
**Trusted Web Activity** gewickelt – eine dünne Android-Hülle, die die Web-App
im Vollbild ohne Browser-Leiste anzeigt. Der Code bleibt unverändert. Nötig sind:

1. Ein Play-Console-Konto (einmalig ~25 $).
2. Eine feste Domain für die App.
3. Eine Datei `/.well-known/assetlinks.json` auf dieser Domain, die den
   Signaturschlüssel des APK nennt – damit beweist die Hülle, dass sie zur
   Domain gehört, und die Browser-Adressleiste verschwindet.
4. Das Hüllen-Projekt selbst, üblicherweise mit `bubblewrap` erzeugt.

Das Manifest der App ist bereits passend gesetzt (`display: standalone`, Icons
inklusive maskable-Variante, `scope: /`), sodass dieser Schritt später ohne
Umbau möglich ist.

## Datenschutz

- Datenbank und Speicher liegen in der EU (Frankfurt), wenn das Projekt in
  dieser Region angelegt wird.
- Es werden keine Analyse- oder Werbedienste eingebunden.
- `public/robots.txt` hält Suchmaschinen fern.
- Der `anon key` im Frontend ist dafür vorgesehen, öffentlich zu sein – den
  Zugriff regeln die Policies in der Datenbank. Der `service_role key` umgeht
  diese Policies und gehört nie in die App oder ins Repository.
