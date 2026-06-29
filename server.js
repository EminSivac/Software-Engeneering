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
  "ministral-3-3b-instruct-2512",
  "google/gemma-4-e4b",
  "qwen/qwen3.5-9b",
];
VLM = "qwen/qwen3.5-9b";

// Globale Jobqueue
const jobs = {};
let queue = [];
let running = false;

// DB Setup
const resultsDb = new Database("results.db");
const feedbackDb = new Database("feedback.db");
createTable();
createFeedbackTable();

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
  let resultsId =[];

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

    const aiResult = safeParse(raw);

    const resultId = insertResult(MODELS[i], aiResult?.müllart || "Unbekannt",results[i].stats.totalTimeSec);

    resultsId.push(resultId);
  }

  return JsonCompose(results, nameItem, resultsId);
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
    console.error("JOB ERROR:", err);
    job.status = "error";
    job.step = err.message || String(err);

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

function JsonCompose(results, nameItemResult, resultsId) {
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

    const stats = parsed ? getHistoricalAccuracy(model, parsed.müllart): { accuracy: null, samples: 0 };

    output[model] = {
        id: resultsId[index],
        ...parsed,
        historicalAccuracy: stats.accuracy,
        sampleCount: stats.samples

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

function insertResult(model, predicted_material, latency) {
  const insert = resultsDb.prepare(
    "INSERT INTO results (model, predicted_material, actual_material, correct, latency) VALUES (?, ?, NULL, NULL, ?)",
  );
  const info = insert.run(model, predicted_material, latency);

  return info.lastInsertRowid;
}

app.post("/feedback", (req, res) => {
  const { resultId, model, material, bin, safety, feedback } = req.body;

  feedbackDb
    .prepare(
      `
    INSERT INTO feedback (model, material, bin, safety, feedback)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(model, material, bin, safety, feedback);

    if (feedback === "yes" || feedback === "no") {

    resultsDb.prepare(`
        UPDATE results
        SET correct = ? , actual_material = ?
        WHERE id = ?
    `).run(
        feedback === "yes" ? 1 : 0,
        material,
        resultId
    );

}

  res.json({ success: true });
});

function createTable() {
  resultsDb
    .prepare(
      `
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY,
    model TEXT,
    predicted_material TEXT, 
    actual_material TEXT,
    correct BOOLEAN, 
    latency INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
    )
    .run();
}
//response ist jetzt predicted material, also das was die KI vorhersagt 

function createFeedbackTable() {
  feedbackDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS feedback(
    id  INTEGER PRIMARY KEY,
    model TEXT,
    material TEXT,
    bin TEXT,
    safety TEXT, 
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    )
    .run();
}

function getHistoricalAccuracy(model, material) {

    const row = resultsDb.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(correct) as correct
        FROM results
        WHERE model = ?
        AND predicted_material = ?
        AND correct IS NOT NULL
    `).get(model, material);

    if (!row.total) {

        return {
            accuracy: null,
            samples: 0
        };
    }

    return {

        accuracy: Math.round(row.correct / row.total * 100),
        samples: row.total

    };

}