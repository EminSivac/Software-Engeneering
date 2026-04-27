🗑️ Müll-Erkennung mit AI (LM Studio)

Ein einfaches Tool zur automatischen Müllklassifizierung anhand von Bildern.
Das System nutzt ein lokales Vision-Language-Modell über LM Studio.

🚀 Features
📷 Bild-Upload im Browser
🤖 Lokale KI (kein Cloud-Zwang)
♻️ Müllklassifizierung:
Müllart (Papier, Plastik, etc.)
Richtiger Behälter
Sicherheitseinschätzung
⚡ Schnelle Verarbeitung (lokal)
🧱 Architektur
Frontend (HTML/JS)
    ↓
Node.js Backend (Express)
    ↓
LM Studio (VLM Model)

👉 Wichtig:
Das Frontend spricht nicht direkt mit LM Studio.

📦 Voraussetzungen
Node.js (>= 18)
LM Studio installiert

Geladenes Modell:

lms get qwen2-vl-2b-instruct
⚙️ Installation
git clone <repo>
cd <repo>

npm install
▶️ Start
1. LM Studio starten
Modell laden: qwen2-vl-2b-instruct
Server aktivieren (Port: 1234)
2. Backend starten
node server.js

Server läuft auf:

http://localhost:3000
3. Frontend öffnen

Einfach index.html im Browser öffnen
oder mit Live Server starten.

📡 API
POST /analyze

Sendet ein Bild zur Analyse.

Request
multipart/form-data
Feld: image
Response (Beispiel)
{
  "müllart": "Papier",
  "behälter": "Blaue Tonne",
  "sicherheit": "hoch"
}
⚠️ Bekannte Probleme
❌ Modell gibt kein JSON zurück

Das verwendete Modell ist klein und nicht 100% zuverlässig.

👉 Lösung im Code:

JSON wird per Regex extrahiert
Fallback wird genutzt
❌ CORS Fehler
CORS Missing Allow Origin

👉 Fix im Backend:

import cors from "cors";
app.use(cors());
❌ LM Studio nicht erreichbar
Läuft LM Studio?
Ist der Server aktiv?
Port korrekt (1234)?
🧠 Technische Details
Backend: Express + Multer
KI-Anbindung: LM Studio SDK
Modell: qwen2-vl-2b-instruct
Kommunikation: REST API
📌 Verbesserungspotenzial
🔼 Größeres Modell (z. B. bessere Accuracy)
🧠 Besseres Prompting
🧾 Striktes JSON-Parsing
🎨 UI verbessern
📊 Logging & Fehlerhandling
❗ Ehrliche Einschätzung

Das System funktioniert, aber:

Klassifikation ist heuristisch
Modell ist nicht 100% zuverlässig
JSON muss nachbearbeitet werden
