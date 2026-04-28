import express from "express";
import multer from "multer";
import { LMStudioClient } from "@lmstudio/sdk";
import fs from "fs";
import cors from "cors";

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());

const client = new LMStudioClient();

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    const nameItemResult = await GetNameOfItem("qwen2-vl-2b-instruct", req);

    const result = await GetAIResponse(
      "mistralai/mistral-7b-instruct-v0.3",
      nameItemResult,
    );

    console.log(
      JsonComp(result, nameItemResult, ["mistralai/mistral-7b-instruct-v0.3"]),
    );

    res.json({
      content: result.content,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));

function JsonComp(result, nameItemResult, AiModel) {
  let resultJson = '{ "NameItem" : "' + nameItemResult + '",';
  for (const i of AiModel) {
    resultJson += '"' + i + '":' + result.content + ",";
  }
  resultJson = resultJson.slice(0, -1) + "}";
  return resultJson;
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

  console.log("Name des Gegenstands:", result.content);
  return result.content;
}
