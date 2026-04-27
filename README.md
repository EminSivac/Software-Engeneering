# 🗑️ Müll-Erkennung mit AI (LM Studio)

Ein einfaches Tool zur automatischen Müllklassifizierung anhand von Bildern.
Das System nutzt ein lokales Vision-Language-Modell über LM Studio.

## 🚀 Features
* 📷 Bild-Upload im Browser
* 🤖 Lokale KI (kein Cloud-Zwang)
* ♻️ Müllklassifizierung:
    * Müllart (Papier, Plastik, etc.)
    * Richtiger Behälter
    * Sicherheitseinschätzung
* ⚡ Schnelle Verarbeitung (lokal)
## 🧱 Architektur
```
Frontend (HTML/JS)
    ↓
Node.js Backend (Express)
    ↓
LM Studio (VLM Model)
```
👉 Wichtig:
Das Frontend spricht nicht direkt mit LM Studio.

## 📦 Voraussetzungen
Node.js (>= 18)

LM Studio installiert

Installiertes Modell: `qwen2-vl-2b-instruct`
## ⚙️ Installation
### ▶️ Start
1. LM Studio starten
    * Modell laden: qwen2-vl-2b-instruct
    * Server aktivieren (Port: 1234)
        * CORS aktivieren
2. Backend starten
    * node server.js im Projekt-Pfad eingeben
    * `Server läuft auf: http://localhost:3000`
3. Frontend öffnen
    * Einfach index.html im Browser öffnen
