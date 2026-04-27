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
    const model = await client.llm.model("qwen2-vl-2b-instruct");

    const image = await client.files.prepareImage(req.file.path);

    const result = await model.respond([
      {
        role: "user",
        content: `
          Du bist ein Müll-Trennsystem.

          Antworte ausschließlich mit gültigem JSON.
          KEIN Text, KEINE Erklärungen.

          Format:
          {"müllart":"","behälter":"","sicherheit":""}

          Erlaubte Werte:
          - müllart: Papier, Plastik, Restmüll, Bio
          - behälter: Gelber Sack, Blaue Tonne, Restmüll, Biomüll
          - sicherheit: hoch, mittel, niedrig

          Wenn unsicher → trotzdem best guess.

          Bild:
          `,
        images: [image],
      },
    ]);

    res.json({
      content: result.content,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));
