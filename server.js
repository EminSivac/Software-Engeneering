import express from "express";
import multer from "multer";
import { LMStudioClient } from "@lmstudio/sdk";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";

// Modelle, die verglichen werden. @All Wir müssen und noch auf genaue einigen.
const MODELS = [
  "mistralai/mistral-7b-instruct-v0.3",
  "qwen/qwen3.5-9b",
  "google/gemma-4-e4b",
];

// const MODELS = ["google/gemma-4-e4b"];

const db = new Database("results.db");

createTable();

const app = express();
app.use(express.static("public"));
const upload = multer({ dest: "uploads/" });
app.use(cors());

const client = new LMStudioClient();
//Lade die Modelle vorab, damit sie schneller reagieren
for (const model of MODELS) {
  client.llm.model(model);
}

app.post("/analyze", upload.single("image"), async (req, res) => {
  let results = [];
  try {
    // Gegendstand erkennen lassen durch die VLM
    const nameItemResult = await GetNameOfItem("qwen/qwen3.5-9b", req);

    // Gegenstand durch die LLMs sortieren lassen
    for (const model of MODELS) {
      const result = await GetAIResponse(model, nameItemResult);
      results.push(result); // in den Results Array packen
    }

    // console.log("Ergebnisse:", results);

    // Ergebnisse in DB speichern
    for (let i = 0; i < MODELS.length; i++) {
      insertResult(
        MODELS[i],
        extractJSON(results[i].nonReasoningContent),
        results[i].stats.totalTimeSec,
      );
    }

    // Res für Forntend zurückgeben
    res.json(JsonCompose(results, nameItemResult));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));

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
          Sag mir den Namen des Gegenstands auf dem Bild. Antworte ausschließlich mit einem Wort, KEIN Text, KEINE Erklärungen.
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
