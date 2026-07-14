// imports
import express from "express";
import multer from "multer";
import { LMStudioClient } from "@lmstudio/sdk";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";
import os from "os";

const memory = os.totalmem() / 1024 / 1024 / 1024;

export function selectModels(availableMemory) {
  if (availableMemory > 16) {
    return {
      models: ["mistralai/mistral-7b-instruct-v0.3", "google/gemma-4-e4b", "qwen/qwen3.5-9b"],
      vlm: "qwen/qwen3.5-9b",
    };
  }
  if (availableMemory > 12) {
    return {
      models: ["qwen2-vl-2b-instruct", "mistralai/mistral-7b-instruct-v0.3"],
      vlm: "qwen2-vl-2b-instruct",
    };
  }
  return { models: ["qwen2-vl-2b-instruct"], vlm: "qwen2-vl-2b-instruct" };
}

// Modelle, die verglichen werden. @All Wir müssen und noch auf genaue einigen.
// Volle Version der APP (Brauchst viel Leistung)

let MODELS;
let VLM;

/* node:coverage disable */
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
/* node:coverage enable */
// Globale Jobqueue
export const jobs = {};
export let queue = [];
export let running = false;

// DB Setup
let db = new Database(process.env.RESULTS_DB_PATH || "results.db");
createTable();

// Express Setup
export const app = express();
app.use(express.static("public"));
const upload = multer({ dest: "uploads/" });
app.use(cors());

// LMStudio Setup
let client = process.env.NODE_ENV === "test" ? null : new LMStudioClient();
//Lade die Modelle vorab, damit sie schneller reagieren
/* node:coverage disable */
if (process.env.NODE_ENV !== "test") {
  for (const model of MODELS) {
    client.llm.model(model);
  }
}

// Müllanalyse
/* node:coverage enable */
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

export function startServer(port = 3000) {
  return app.listen(port, () => console.log(`Server läuft auf Port ${port}`));
}

if (process.env.NODE_ENV !== "test") startServer();

export function configureRuntime({ models, vlm, lmClient, database } = {}) {
  if (models) MODELS = models;
  if (vlm) VLM = vlm;
  if (lmClient) client = lmClient;
  if (database) db = database;
}

export function resetQueue() {
  queue = [];
  running = false;
  for (const jobId of Object.keys(jobs)) delete jobs[jobId];
}

// Helper
export async function WastEvaluation(req, job) {
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

export async function processQueue() {
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
  await processQueue();
}

export function updatePositions() {
  queue.forEach((item, index) => {
    jobs[item.jobId].position = index + 1;
  });
}

export function safeParse(text) {
  const cleaned = extractJSON(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function JsonCompose(results, nameItemResult) {
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

export async function GetAIResponse(AiModel, ItemName) {
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

export async function GetNameOfItem(AiModel, req) {
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

export function extractJSON(text) {
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

export function cleanJSONString(str) {
  return str.replace(/\n/g, "").replace(/\r/g, "").replace(/\t/g, "").trim();
}

export function insertResult(model, response, latency) {
  const insert = db.prepare(
    "INSERT INTO results (model, response, latency) VALUES (?, ?, ?)",
  );
  insert.run(model, response, latency);
}

export function createTable() {
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
