# Pflasterpost – Ratgeber für Eltern kleiner Kinder

Eine statische Web-App (GitHub Pages) mit:

- **Bibliothek** mit 25 häufigen Kinderkrankheiten: Erkennungszeichen, Ursachen, Tipps für zu Hause, Behandlung, Warnzeichen („Wann zum Arzt?“ / „Sofort 112“), Kita-Regeln, Vorbeugung und Quellen
- **Suche** über Krankheiten, Symptome und Behandlung/Pflege, mit Filtern nach Bereich und Alter
- **Symptom-Finder**: Symptome anklicken und passende Themen sehen
- **Community**: Registrierung, Profil (Avatar, Kinder, Region, Themen), Erfahrungsberichte zu Krankheiten und Symptomen, „Hilfreich“-Markierungen und Antworten

> **Kein medizinischer Rat.** Die Inhalte sind allgemeine Informationen auf Basis seriöser Quellen (IQWiG/gesundheitsinformation.de, BZgA/kindergesundheit-info.de und infektionsschutz.de, NHS). Sie ersetzen keine ärztliche Beratung.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Grundgerüst, Navigation, Footer |
| `css/styles.css` | Design (warme Farben, Fraunces + Nunito, Dark Mode, mobil) |
| `js/data.js` | Inhalte der Bibliothek (Krankheiten, Symptome, Quellen) |
| `js/community.js` | Speicher-Schicht für Konten, Profile und Beiträge |
| `js/app.js` | Seiten, Suche, Symptom-Finder, Community-Oberfläche |

## Community: Demo-Modus

GitHub Pages hat keinen Server. Konten und Beiträge werden deshalb derzeit **nur im Browser (localStorage)** gespeichert und sind für andere Nutzerinnen und Nutzer nicht sichtbar. Für eine echte, geteilte Community muss ein Backend (z. B. Supabase oder Firebase) angebunden werden. Alle Zugriffe laufen über `js/community.js`, sodass nur diese Datei ersetzt werden muss.

## Lokal starten

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```
