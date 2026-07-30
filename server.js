// imports
import express from "express";
import multer from "multer";
import { LMStudioClient } from "@lmstudio/sdk";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";
//import os from "os";
//import sharp from "sharp";

const LMSTUDIOIP = "ws://100.100.113.26:1234";
const LOCAL_HOST = "ws://127.0.0.1:1234";

// Modelle, die verglichen werden. @All Wir müssen und noch auf genaue einigen.
// Volle Version der APP (Brauchst viel Leistung)

let MODELS;
let VLM;

MODELS = [
  "mistralai/mistral-7b-instruct-v0.3",
  "google/gemma-4-e4b",
  "qwen/qwen3.5-9b",
];
VLM = "qwen/qwen3.5-9b";

// Globale Jobqueue
const jobs = {};
let queue = [];
let running = false;

// DB Setup
const db = new Database("database.db");
createTables();

// Express Setup
const app = express();
app.use(express.static("public"));
const upload = multer({ dest: "uploads/" });
app.use(cors());

app.use(express.json());

// LMStudio Setup
let client;

async function createClient() {
  try {
    const remoteClient = new LMStudioClient({
      baseUrl: LMSTUDIOIP,
    });

    // Test, ob der Server erreichbar ist
    await remoteClient.system.listDownloadedModels();

    console.log("Verbunden mit Remote-LM Studio");
    return remoteClient;
  } catch (err) {
    try {
      console.log("Remote nicht erreichbar, nutze localhost.");

      return new LMStudioClient({
        baseUrl: LOCAL_HOST,
      });
    } catch (err) {
      console.error("Fehler beim Verbinden mit lokalem LM Studio:", err);
      process.exit(1);
    }
  }
}

client = await createClient();
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

  let resultIds = []; 

  for (let i = 0; i < MODELS.length; i++) {
    const raw = results[i].nonReasoningContent || results[i].content || "";

     const id = insertResult(
        MODELS[i],
        extractJSON(raw),
        results[i].stats.totalTimeSec
      );

 resultIds.push(id);
  }

  return JsonCompose(results, nameItem, resultIds);
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

function JsonCompose(results, nameItemResult, resultIds) {
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

    output[model] = {
    id: resultIds[index],
    ...parsed
    };
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
const parsed = safeParse(response);

  const insert = db.prepare(`
    INSERT INTO results 
    (model, response, predicted_material, latency)
    VALUES (?, ?, ?, ?)
  `);

  const result = insert.run(
    model,
    response,
    parsed?.müllart || "Unknown",
    latency
  );

  return result.lastInsertRowid;

}

app.post("/feedback", (req, res) => {
  const { resultId, feedback, actualMaterial } = req.body;

  db.prepare(
      `
    INSERT INTO feedback (result_id, feedback)
    VALUES (?, ?)
  `,
    )
    .run(resultId, feedback);

   if(feedback === "yes" || feedback === "no"){

   db.prepare(`
    UPDATE results
    SET
      correct=?,
      actual_material=?
    WHERE id=?
   `)
   .run(
     feedback === "yes" ? 1 : 0,
     actualMaterial,
     resultId
   );

 }

  res.json({ success: true });
});

function createTables() {
  db.prepare(
      `
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY,
    model TEXT,
    response TEXT,
    predicted_material TEXT,
    actual_material TEXT,
    correct INTEGER,
    latency INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
    )
    .run();

  db.prepare(
      `CREATE TABLE IF NOT EXISTS feedback(
    id  INTEGER PRIMARY KEY,
    result_id INTEGER,
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(result_id)
    REFERENCES results(id)
    )`
    )
    .run();
}
