import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.RESULTS_DB_PATH = ":memory:";

const serverModule = await import("../server.js");

const writes = [];
const database = {
  prepare(sql) {
    return {
      run(...values) {
        writes.push({ sql, values });
      },
    };
  },
};

function createClient({ invalidClassification = false, fail = false } = {}) {
  let uploadedPath;
  return {
    get uploadedPath() { return uploadedPath; },
    files: { prepareImage: async (path) => {
      uploadedPath = path;
      return { path };
    } },
    llm: {
      model: async (name) => ({
        respond: async (messages) => {
          if (fail) throw new Error("Modell nicht erreichbar");
          if (messages[0].images) {
            return { nonReasoningContent: '{"name":"Dose","description":"Getränkedose"}' };
          }
          return {
            nonReasoningContent: invalidClassification
              ? "keine JSON-Antwort"
              : '{"müllart":"Restmüll","behälter":"Restmüll Tonne","sicherheit":"hoch"}',
            stats: { totalTimeSec: name.length },
          };
        },
      }),
    },
  };
}

test("selectModels wählt alle drei Hardware-Profile", () => {
  assert.equal(serverModule.selectModels(17).models.length, 3);
  assert.equal(serverModule.selectModels(13).models.length, 2);
  assert.deepEqual(serverModule.selectModels(8), {
    models: ["qwen2-vl-2b-instruct"],
    vlm: "qwen2-vl-2b-instruct",
  });
});

test("HTTP-Endpunkte liefern Status, Fehler und nehmen einen Analyseauftrag an", async () => {
  const lmClient = createClient();
  serverModule.resetQueue();
  serverModule.configureRuntime({
    models: ["modell"],
    vlm: "vision",
    lmClient,
    database,
  });
  const httpServer = serverModule.startServer(0);
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const missing = await fetch(`${baseUrl}/status/unbekannt`);
    assert.equal(missing.status, 404);

    serverModule.jobs.vorhanden = { status: "queued" };
    const existing = await fetch(`${baseUrl}/status/vorhanden`);
    assert.deepEqual(await existing.json(), { status: "queued" });

    const form = new FormData();
    form.set("image", new Blob(["testbild"], { type: "image/jpeg" }), "test.jpg");
    const response = await fetch(`${baseUrl}/analyze`, { method: "POST", body: form });
    assert.equal(response.status, 200);
    const { jobId } = await response.json();

    for (let attempt = 0; attempt < 20 && serverModule.jobs[jobId].status === "queued"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(serverModule.jobs[jobId].status, "done");
  } finally {
    await new Promise((resolve) => httpServer.close(resolve));
    if (lmClient.uploadedPath) await fs.unlink(lmClient.uploadedPath);
  }
});

test("JSON-Helfer behandeln Codeblöcke, Rohdaten und ungültige Eingaben", () => {
  assert.equal(serverModule.cleanJSONString(" \n{\t\"a\":1}\r "), '{"a":1}');
  assert.equal(serverModule.extractJSON("```json\n{\"a\": 1}\n```"), '{"a": 1}');
  assert.equal(serverModule.extractJSON("Text {\"a\": 1} Ende"), '{"a": 1}');
  assert.equal(serverModule.extractJSON("ohne JSON"), null);
  assert.equal(serverModule.extractJSON(""), null);
  assert.deepEqual(serverModule.safeParse('{"name":"Glas"}'), { name: "Glas" });
  assert.equal(serverModule.safeParse("{ungültig}"), null);
  assert.equal(serverModule.safeParse("ungültig"), null);
});

test("JsonCompose verarbeitet gültige und ungültige Modellantworten", () => {
  serverModule.configureRuntime({ models: ["eins", "zwei"] });
  const result = serverModule.JsonCompose([
    { nonReasoningContent: '{"wert":1}' },
    { nonReasoningContent: "{ungültig}" },
  ], "Flasche");
  assert.deepEqual(result.eins, { wert: 1 });
  assert.deepEqual(result.zwei, { error: "invalid json", raw: "{ungültig}" });
  assert.equal(result.NameItem, "Flasche");
});

test("KI-Funktionen, Speicherung und Auswertung arbeiten mit der Laufzeit-Schnittstelle", async () => {
  writes.length = 0;
  serverModule.configureRuntime({
    models: ["modell-a", "modell-b"],
    vlm: "vision",
    lmClient: createClient(),
    database,
  });

  const classification = await serverModule.GetAIResponse("modell-a", "Dose");
  assert.equal(classification.stats.totalTimeSec, 8);
  assert.equal(await serverModule.GetNameOfItem("vision", { file: { path: "bild.jpg" } }), '{"name":"Dose","description":"Getränkedose"}');

  serverModule.insertResult("modell-a", "{}", 1);
  serverModule.createTable();
  assert.equal(writes.length, 2);

  const job = {};
  const output = await serverModule.WastEvaluation({ file: { path: "bild.jpg" } }, job);
  assert.equal(job.step, "Speichern");
  assert.equal(output.NameItem, "Dose");
  assert.equal(output["modell-b"].sicherheit, "hoch");
  assert.equal(writes.length, 4);
});

test("processQueue setzt Erfolg, Fehler und Warteschlangenpositionen", async () => {
  serverModule.resetQueue();
  serverModule.configureRuntime({
    models: ["modell"],
    vlm: "vision",
    lmClient: createClient(),
    database,
  });
  serverModule.jobs.erster = { status: "queued", position: 1, result: null };
  serverModule.jobs.zweiter = { status: "queued", position: 2, result: null };
  serverModule.queue.push(
    { jobId: "erster", req: { file: { path: "a.jpg" } } },
    { jobId: "zweiter", req: { file: { path: "b.jpg" } } },
  );
  await serverModule.processQueue();
  assert.equal(serverModule.jobs.erster.status, "done");
  assert.equal(serverModule.jobs.zweiter.status, "done");
  assert.equal(serverModule.queue.length, 0);

  serverModule.resetQueue();
  serverModule.configureRuntime({ lmClient: createClient({ fail: true }) });
  serverModule.jobs.fehler = { status: "queued", position: 1, result: null };
  serverModule.queue.push({ jobId: "fehler", req: { file: { path: "c.jpg" } } });
  await serverModule.processQueue();
  assert.equal(serverModule.jobs.fehler.status, "error");
  assert.equal(serverModule.jobs.fehler.step, "Modell nicht erreichbar");

  serverModule.resetQueue();
  serverModule.jobs.a = { position: 0 };
  serverModule.jobs.b = { position: 0 };
  serverModule.queue.push({ jobId: "a" }, { jobId: "b" });
  serverModule.updatePositions();
  assert.equal(serverModule.jobs.a.position, 1);
  assert.equal(serverModule.jobs.b.position, 2);
});
