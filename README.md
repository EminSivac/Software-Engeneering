# 🗑️ AI Müllvergleich - Waste Classification System

Ein lokales KI-basiertes System zur automatischen Müllklassifizierung. Das Tool analysiert Bilder von Abfällen und empfiehlt den richtigen Behälter, unterstützt durch mehrere Vision-Language-Modelle.

---

## 🎯 Was macht dieses Projekt?

- **Bildanalyse**: Laden Sie ein Bild eines Abfallstücks hoch
- **KI-Klassifizierung**: Mehrere lokale KI-Modelle analysieren das Bild parallel
- **Vergleich**: Sehen Sie die Ergebnisse aller Modelle nebeneinander
- **Empfehlung**: Das System schlägt den korrekten Müllbehälter vor
- **Feedback**: Geben Sie Rückmeldungen, um die KI zu verbessern

---

## 🚀 Quick Start Guide

### 1️⃣ Voraussetzungen prüfen

**Benötigte Software:**

```bash
# Node.js installieren (Version 18 oder höher)
# Herunterladen von: https://nodejs.org/

# LM Studio installieren (für lokale KI-Modelle)
# Herunterladen von: https://lmstudio.ai/
```

### 2️⃣ Projekt vorbereiten

```bash
# Zum Projekt-Verzeichnis wechseln
cd ...

# Abhängigkeiten installieren
npm install
```

### 3️⃣ KI-Modelle in LM Studio laden

Öffnen Sie **LM Studio** und laden Sie mindestens eines dieser Modelle:

- `ministral-3-3b-instruct-2512` (schnell, weniger Ressourcen)
- `qwen/qwen3.5-9b` (empfohlen, gute Balance)
- `google/gemma-4-e4b` (alternative Option)

**Wichtig**: Die Modelle müssen lokal installiert sein - keine Cloud-APIs verwenden!

### 4️⃣ System starten

```bash
# LM Studio Server starten
# - Port: 1234
# - CORS aktivieren (in den Einstellungen)
# - Server-Status sollte "Running" anzeigen

# Backend starten
node server.js

# Frontend öffnen
# http://localhost:3000
# Oder: http://{Ihr_IP}:3000 (für andere Geräte)
```

---

## 📖 Verwendung

1. **Bild hochladen**: Klicken Sie auf "Choose File" und wählen Sie ein Bild aus
2. **Analysieren**: Klicken Sie auf den "Analysieren"-Button
3. **Ergebnisse sehen**: Vergleichen Sie die Klassifizierungen aller KI-Modelle
4. **Feedback geben**: Markieren Sie korrekte oder falsche Vorhersagen

---

## 🏗️ Architektur

```
┌─────────────┐
│   User      │
└──────┬──────┘
       ↓
┌─────────────┐
│ Frontend    │  ← HTML/CSS/JavaScript
│ (public/)   │     - Bild-Upload
│             │     - Ergebnis-Anzeige
└──────┬──────┘
       ↓
┌─────────────┐
│ Backend     │  ← Node.js + Express
│ (server.js) │     - API Endpoints
│             │     - Queue Management
└──────┬──────┘
       ├───────────────┐
       ↓               ↓
┌─────────────┐  ┌─────────────┐
│ LM Studio   │  │ SQLite DB   │
│ API         │  │ (results.db)│
└─────────────┘  └─────────────┘
     Vision Language Models
     - Qwen
     - Gemma
     - Ministral
```

---

## 📁 Projektstruktur

```
Software-Engineering/
├── server.js          # Haupt-Backend Logik
├── package.json       # Node.js Abhängigkeiten
├── public/            # Frontend Dateien
│   ├── index.html     # Hauptseite
│   └── style.css      # Styling
├── docs/              # Dokumentation
│   ├── architecture.md
│   ├── requirements.md
│   └── ai-reflection.md
├── uploads/           # Temporäre Bild-Uploads
└── *.db               # SQLite Datenbanken
```

---

## 🎯 API Endpoints

### POST `/analyze`

Bild hochladen zur Analyse

**Request:**

- `multipart/form-data` mit Feld `image`

**Response:**

```json
{
  "jobId": "1234567890"
}
```

### GET `/status/:id`

Status einer Analyse abrufen

**Response:**

```json
{
  "jobId": "1234567890",
  "status": "completed",
  "step": "Ergebnis",
  "position": 0,
  "result": {
    "model": "qwen/qwen3.5-9b",
    "data": { ... }
  }
}
```

---

## 🛠️ Konfiguration

### LM Studio IP-Adresse

In `server.js` können Sie die Verbindungsparameter anpassen:

```javascript
// Remote LM Studio (für Netzwerk-Zugriff)
const LMSTUDIOIP = "ws://{remote IP}:1234";

// Lokaler LM Studio
const LOCAL_HOST = "ws://{localhost}:1234";
```

### Verfügbare Modelle

Das System unterstützt mehrere Modelle gleichzeitig:

```javascript
MODELS = [
  "ministral-3-3b-instruct-2512",
  "google/gemma-4-e4b",
  "qwen/qwen3.5-9b",
];
```

---

## 📊 Datenbanken

Das System verwendet SQLite für persistente Speicherung:

- **results.db**: Analyse-Ergebnisse und Vorhersagen
- **feedback.db**: Benutzer-Feedback zur Modell-Bewertung

---

## 🔧 Troubleshooting

### Problem: "Remote nicht erreichbar"

**Lösung:**

1. LM Studio Server starten
2. In LM Studio: Settings → Server → Port auf `1234` setzen
3. CORS in den Einstellungen aktivieren
4. IP-Adresse prüfen (ob Remote oder Local)

### Problem: "Model nicht gefunden"

**Lösung:**

1. Modell in LM Studio herunterladen
2. Unter Models im Tab auswählen
3. Server neu starten

### Problem: "Port bereits belegt"

**Lösung:**

1. Andere Port-Nummer verwenden (in `server.js`)
2. Oder bestehenden Prozess beenden

---

## 🤝 Beiträge

Dieses Projekt dient als Proof-of-Concept für lokale KI-gestützte Müllklassifizierung.

Für Fragen oder Issues: Bitte die Dokumentation in `docs/` konsultieren.
