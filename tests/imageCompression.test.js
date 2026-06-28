//um zu testen muss vitest installiert sein, dann kann man `npm test` ausführen

import { describe, it, expect } from "vitest";
import fs from "fs";
import { compressImageIfNeeded } from "../imageCompression.js";

describe("Bildkomprimierung", () => {

  it("komprimiert Bilder größer als 1 MB", async () => {

    await fs.promises.copyFile( //damit mehrere tests möglich und nicht direkt kleiner als 1mb nutzt kopie 
      "tests/images/original.jpg",
      "tests/images/test.jpg"
    );

    const path = "tests/images/test.jpg";

    const before = (await fs.promises.stat(path)).size;

    await compressImageIfNeeded(path);

    const after = (await fs.promises.stat(path)).size;

    expect(after).toBeLessThan(before);

  });

});