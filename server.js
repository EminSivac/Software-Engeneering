// imports
import express from "express";
import multer from "multer";
import { LMStudioClient } from "@lmstudio/sdk";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";
import os from "os";
import sharp from "sharp";

const memory = os.totalmem() / 1024 / 1024 / 1024;

// Modelle, die verglichen werden. @All Wir müssen und noch auf genaue einigen.
// Volle Version der APP (Brauchst viel Leistung)

let MODELS;
let VLM;

if (memory > 16) {
  MODELS = [
    "mistralai/mistral-7b-instruct-v0.3",
    "google/gemma-4-e4b",
    "qwen/qwen3.5-9b",
  ];
  VLM = "qwen/qwen3.5-9b";
} else if (memory > 12) {
  MODELS = ["qwen2-vl-2b-instruct", "mistralai/mistral-7b-instruct-v0.3"];
  VLM = "qwen2-vl-2b-instruct";
} else {
  // Schwachere Modelle für Tests (Schneller, weniger Leistung nötig)
  MODELS = ["qwen2-vl-2b-instruct"];
  VLM = "qwen2-vl-2b-instruct";
}
// Globale Jobqueue
const jobs = {};
let queue = [];
let running = false;

// DB Setup
const db = new Database("results.db");
createTable();

// Express Setup
const app = express();
app.use(express.static("public"));
const upload = multer({ dest: "uploads/" });
app.use(cors());

// LMStudio Setup
const client = new LMStudioClient();
//Lade die Modelle vorab, damit sie schneller reagieren
for (const model of MODELS) {
  client.llm.model(model);
}

// Müllanalyse
app.post("/analyze", upload.single("image"), async (req, res) => {
  const jobId = Date.now().toString();

  jobs[jobId] = {
    status: "queued",
    step: "Warteschlange",
    position: queue.length + 1,
    result: null,
  };

  queue.push({ jobId, req });

  processQueue();

  res.json({ jobId });
});

app.get("/status/:id", (req, res) => {
  const job = jobs[req.params.id];

  if (!job) {
    return res.status(404).send("Job nicht gefunden");
  }

  res.json(job);
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));

// Helper
async function WastEvaluation(req, job) {
  console.log(queue);
  let results = [];

  job.step = "Objekt wird erkannt";

  const nameItemRaw = await GetNameOfItem(VLM, req);
  const parsed = safeParse(nameItemRaw);
  const nameItem = parsed?.name || "unbekannt";

  job.step = "Modelle starten";

  for (const model of MODELS) {
    job.step = `läuft: ${model}`;

    const result = await GetAIResponse(model, nameItem);
    results.push(result);
  }

  job.step = "Speichern";

  for (let i = 0; i < MODELS.length; i++) {
    const raw = results[i].nonReasoningContent || results[i].content || "";

    insertResult(MODELS[i], extractJSON(raw), results[i].stats.totalTimeSec);
  }

  return JsonCompose(results, nameItem);
}

async function processQueue() {
  if (running || queue.length === 0) return;

  running = true;

  const { jobId, req } = queue.shift();
  const job = jobs[jobId];
  job.position = null;

  updatePositions();

  try {
    const result = await WastEvaluation(req, job);

    job.result = result;
    job.status = "done";
    job.step = "Fertig";
  } catch (err) {
    job.status = "error";
    job.step = err.message;
  }

  running = false;
  processQueue();
}

function updatePositions() {
  queue.forEach((item, index) => {
    jobs[item.jobId].position = index + 1;
  });
}

function safeParse(text) {
  const cleaned = extractJSON(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function JsonCompose(results, nameItemResult) {
  const output = {
    NameItem: nameItemResult,
  };

  MODELS.forEach((model, index) => {
    const raw = results[index].nonReasoningContent;
    const cleaned = extractJSON(raw);

    let parsed = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { error: "invalid json", raw };
    }

    output[model] = parsed;
  });

  return output;
}

async function GetAIResponse(AiModel, ItemName) {
  const model = await client.llm.model(AiModel);

  const result = await model.respond([
    {
      role: "user",
      content: `
          Du bist ein deutsches Mülltrennsystem.

          Regeln:
          - Papier → Blaue Tonne
          - Plastic/Verpackungen → Gelber Tonne
          - Bio/Organisch → Bio Tonne
          - Rest → Rest Tonne

          Antworte ausschließlich mit gültigem JSON.
          KEIN Text, KEINE Erklärungen.

          Format:
          {"müllart":"","behälter":"","sicherheit":""}

          Erlaubte Werte:
          - müllart: Papier, Plastic/Verpackungen, Restmüll, Bio/Organisch
          - behälter: Plastic/Verpackungen Tonne, Papier Tonne, Restmüll Tonne, Bio Tonne
          - sicherheit: hoch, mittel, niedrig

          Wenn unsicher → trotzdem best guess.

          Das Bild zeigt: ${ItemName}
          `,
    },
  ]);

  return result;
}

async function GetNameOfItem(AiModel, req) {
  const model = await client.llm.model(AiModel);

  const image = await client.files.prepareImage(req.file.path);

  const result = await model.respond([
    {
      role: "user",
      content: `     
      Sag mir den Namen des Gegenstands auf dem Bild. Gerne eine kleine Beschreibung.

      Antoworte als Json mit folgendem Format:
      {"name":"", "description":""}
          `,
      images: [image],
    },
  ]);

  console.log("Name des Gegenstands:", result.nonReasoningContent);
  return result.nonReasoningContent;
}

function extractJSON(text) {
  if (!text) return null;

  // 1. ```json block bevorzugen
  const codeMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (codeMatch) {
    return cleanJSONString(codeMatch[1].trim());
  }

  // 2. normales JSON extrahieren (inkl. multiline)
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return cleanJSONString(match[0].trim());
  }

  return null;
}

function cleanJSONString(str) {
  return str.replace(/\n/g, "").replace(/\r/g, "").replace(/\t/g, "").trim();
}

function insertResult(model, response, latency) {
  const insert = db.prepare(
    "INSERT INTO results (model, response, latency) VALUES (?, ?, ?)",
  );
  insert.run(model, response, latency);
}

function createTable() {
  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY,
    model TEXT,
    response TEXT,
    latency INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
  ).run();
}
