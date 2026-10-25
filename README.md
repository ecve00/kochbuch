# Kochbuch

Rezepte sammeln, Menüs planen, einkaufen und Schritt für Schritt kochen. Auf iPhone, iPad und Mac, mit einer gemeinsamen Supabase-Datenbank.

**Online:** https://ecve00.github.io/kochbuch/ (GitHub Pages, Repository [ecve00/kochbuch](https://github.com/ecve00/kochbuch))

## Was die App kann

- **Startseite:** ein großes Foto aus der Profiküche und rechts dein Kurzprofil: wie viele Gerichte du gekocht hast (gesamt, diesen Monat, dieses Jahr), nach Kategorie und deine meistgekochten Rezepte. Ein Gericht zählt als gekocht, sobald im Kochmodus alle Schritte abgehakt sind. Im Rezept geht es auch per Hand mit „Als gekocht zählen“.
- **Rezepte:** Zutaten und Schritte zeilenweise eintippen, Kategorien, Tags, Quelle, Notizen. Bewertung mit 1–5 Sternen und Kommentare mit Datum. Suche, Sortierung (Name, Bewertung, neueste, schnellste) und Filter nach Kategorie. Mengen rechnen sich mit den Portionen um.
- **Menüs:** Gänge aus Rezepten zusammenstellen, mit Datum und Personenzahl.
- **Einkaufsliste:** Zutaten aus Menüs oder Rezepten übernehmen. Gleiche Zutaten werden zusammengezählt. Abhaken und als Text kopieren (zum Beispiel für die Erinnerungen-App).
- **Kochmodus:** Zutaten und Schritte je Gang abhaken. Der nächste Schritt ist hervorgehoben, und Zeitangaben wie „18 Minuten“ werden zu Timern. Der Fortschritt ist auf allen Geräten gleich.
- **Display wach halten:** Startet automatisch im Kochmodus. Das Sonnen-Symbol oben schaltet es an und aus.
- **Offline:** Die App startet auch ohne Netz und zeigt den letzten Stand. Änderungen werden gesendet, sobald wieder Verbindung besteht.
- **Sicherung:** Unter *Konto* kannst du alles als JSON-Datei herunterladen und wieder importieren.

## Lokal ausprobieren

Es gibt keinen Build-Schritt. Starte im Ordner einen einfachen Webserver:

```bash
python3 -m http.server 8010
```

Dann http://localhost:8010 öffnen. Solange `js/config.js` leer ist, läuft die App im **Demo-Modus** mit drei Beispielrezepten. Die Daten liegen dann nur in diesem Browser.

`index.html` direkt per Doppelklick zu öffnen funktioniert nicht, weil Browser JavaScript-Module unter `file://` blockieren.

## Supabase verbinden

1. Lege auf [supabase.com](https://supabase.com) ein kostenloses Projekt an.
2. **SQL Editor → New query:** Füge den Inhalt von `supabase/schema.sql` ein und klicke auf **Run**. Das legt die Tabellen an, die Zugriffsregeln (jede Person sieht nur ihre eigenen Daten) und Realtime für die Live-Synchronisation.
3. **Project Settings → API:** Kopiere die *Project URL* und den *anon public*-Schlüssel nach `js/config.js`.
4. **Authentication → Sign In / Providers → Email:** Lass *Email* eingeschaltet. Mit *Confirm email* musst du die Adresse nach der Registrierung einmal per Link bestätigen. Schaltest du es aus, geht es ohne Mail.
5. **Authentication → URL Configuration:** Trage als **Site URL** die Adresse ein, unter der die App läuft (siehe unten). Füge sie auch unter **Redirect URLs** hinzu. Sonst führen Bestätigungs- und Passwort-Links ins Leere.
6. Öffne die App und erstelle unter *Konto erstellen* dein Konto. Melde dich auf Mac und iPad mit demselben Konto an.

Die Anmeldung läuft mit E-Mail und Passwort statt mit einem Link per Mail. Auf dem iPad hat die installierte App einen eigenen Speicher, getrennt von Safari: Ein Anmelde-Link würde in Safari landen statt in der App.

## Online stellen

Das Kochbuch läuft über **GitHub Pages** aus dem Branch `main`. Änderungen gehen so online:

```bash
git add -A && git commit -m "Was sich geändert hat" && git push
```

Nach ein bis zwei Minuten ist die neue Fassung unter https://ecve00.github.io/kochbuch/ erreichbar. Erhöhe vorher in `sw.js` die `VERSION`, damit installierte Apps sie laden.

Andere Anbieter gehen genauso:

Die App besteht aus statischen Dateien und braucht eine HTTPS-Adresse, damit sie sich installieren lässt und das Display wach halten kann. Kostenlose Möglichkeiten:

- **Netlify:** Auf [app.netlify.com/drop](https://app.netlify.com/drop) den Ordner `kochbuch` hineinziehen. Du bekommst sofort eine Adresse wie `https://dein-name.netlify.app`.
- **GitHub Pages, Cloudflare Pages oder Vercel** funktionieren genauso.

Die Ordner `artifact/` und `ios/` musst du nicht mit hochladen.

Danach die Adresse in Supabase als Site URL eintragen (Schritt 5).

**Nach Änderungen an den App-Dateien** erhöhst du in `sw.js` die `VERSION` (zum Beispiel `kochbuch-v2`). Dann laden installierte Apps die neue Fassung.

## Als App installieren

- **iPad:** Die Adresse in Safari öffnen, auf *Teilen* tippen und *Zum Home-Bildschirm* wählen.
- **Mac:** Die Adresse in Safari öffnen und im Menü *Ablage → Zum Dock hinzufügen …* wählen (ab macOS Sonoma).

Danach startet das Kochbuch wie eine eigene App, im Vollbild und mit eigenem Symbol.

## iPhone- und iPad-App

Im Ordner `ios/` liegt ein Xcode-Projekt. Es verpackt die Web-App in eine echte App für iPhone und iPad. Funktionen und Supabase-Datenbank sind dieselben, die Daten sind also mit Mac und Browser abgeglichen. Unterschiede zur Web-Fassung:

- Das Display wacht über iOS selbst (`isIdleTimerDisabled`). Das ist zuverlässiger als im Browser.
- „Sicherung herunterladen“ öffnet das iOS-Teilen-Menü (Sichern in Dateien, AirDrop, Mail).
- Links zu anderen Websites öffnen sich in Safari.
- Die App-Dateien sind im App-Bundle. Die App startet sofort, auch ohne Netz.

**Auf dein iPhone bringen**

1. `ios/Kochbuch.xcodeproj` in Xcode öffnen.
2. Links das Projekt *Kochbuch* wählen, dann Target *Kochbuch* → *Signing & Capabilities*. Unter *Team* deine Apple-ID wählen (*Add an Account…*, falls sie fehlt). Falls Xcode meldet, dass die Bundle-ID vergeben ist, ändere `com.eschenroeder.kochbuch` in etwas Eigenes.
3. iPhone per Kabel anschließen und entsperren, oben in Xcode als Ziel auswählen und auf ▶ (Run) klicken.
4. Beim ersten Mal auf dem iPhone: *Einstellungen → Allgemein → VPN & Geräteverwaltung* → deinem Entwicklerprofil vertrauen. Ab iOS 16 außerdem *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* einschalten.

Mit einer kostenlosen Apple-ID läuft die App 7 Tage, danach einfach in Xcode erneut auf ▶ klicken. Mit dem Apple Developer Program (99 € im Jahr) gilt sie ein Jahr, und du kannst sie per TestFlight auch an Familie und Freunde verteilen.

**Nach Änderungen an der Web-App** genügt ein neuer Build in Xcode: Das Projekt kopiert `index.html`, `styles.css`, `js/` und `icons/` bei jedem Build ins App-Bundle.

Zum Ausprobieren ohne Konto: In Xcode unter *Product → Scheme → Edit Scheme → Run → Arguments* das Argument `-demo` hinzufügen. Dann startet die App mit den Beispielrezepten.

## Daten aus der früheren Artifact-Version übernehmen

Die erste Fassung lief als Claude-Artifact. Den Quelltext findest du in `artifact/index.html`. Rezepte von dort lassen sich als JSON im Format `{ "recipes": [...], "menus": [...] }` unter *Konto → Sicherung importieren* einlesen. Beim Import bekommen alle Einträge neue IDs, und die Menüs werden mit den neuen Rezepten verknüpft.

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `index.html`, `styles.css` | Seitengerüst und Gestaltung (hell und dunkel) |
| `manifest.webmanifest`, `icons/` | Name und Symbol für die Installation |
| `sw.js` | Service Worker: hält die App-Dateien für den Offline-Start vor |
| `js/app.js` | Start, Anmeldung, Navigation, Ereignisse |
| `js/state.js` | App-Zustand, Änderungen, Einkaufslisten-Logik, Live-Updates, Sicherung und Import |
| `js/store.js` | Datenschicht: Supabase mit Offline-Warteschlange, oder Demo-Modus im Browser |
| `js/wake.js` | Display wach halten, Küchen-Timer |
| `js/util.js` | Zutaten-Parser, Formatierung, Icons |
| `js/views/*.js` | Rezepte, Menüs, Einkauf, Kochmodus, Konto und Anmeldung |
| `js/config.js` | Supabase-URL und anon-Schlüssel |
| `js/views/home.js` | Startseite mit Foto und Kurzprofil |
| `supabase/schema.sql` | Tabellen, Zugriffsregeln, Realtime |
| `supabase/add_cook_log.sql` | Nur die Tabelle für gekochte Gerichte, für ältere Projekte |
| `ios/` | Xcode-Projekt der iPhone- und iPad-App (SwiftUI + WebKit) |

## Foto

Das Foto der Startseite stammt von [Hemant Latawa auf Unsplash](https://unsplash.com/photos/chef-holding-fry-pan-RKdkETvcYn4) (Unsplash-Lizenz, frei nutzbar). Es wird direkt von Unsplash geladen und für den Offline-Start zwischengespeichert.

## Ideen für später

- Fotos zu Rezepten (Supabase Storage)
- Rezepte mit Familie oder Freunden teilen (gemeinsame Kochbücher)
- Rezept aus einer Webseite importieren
- Einkaufsliste nach Supermarkt-Abteilungen sortieren
