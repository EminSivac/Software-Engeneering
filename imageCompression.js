import fs from "fs";
import sharp from "sharp";

export async function compressImageIfNeeded(filePath) {
  const stats = await fs.promises.stat(filePath);

  const oneMB = 1024 * 1024;

  if (stats.size <= oneMB) {
    return;
  }

// console.log(`Bild größer als 1MB (${(stats.size/ 1024 / 1024).tofiexed(2)}) MB --> wird komprimiert`);


  const tempPath = filePath + ".tmp.jpg";

  await sharp(filePath)
    .rotate()
    .jpeg({
      quality: 80,
      mozjpeg: true, //mozjpeg spart speicherplatz 
    })
    .toFile(tempPath);

  await fs.promises.unlink(filePath);
  await fs.promises.rename(tempPath, filePath);

  //const newStats = await fs.promises.stat(filePath);

  //console.log(`Neue Größe: ${(newStats.size /1024 /1024).toFixed(2)} MB`);
  
}
