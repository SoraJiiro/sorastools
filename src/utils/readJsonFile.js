const fs = require("fs").promises;

async function readJsonFile(filePath, fallback = null) {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Erreur lors de la lecture du fichier JSON ${filePath} :`, error);
    return fallback;
  }
}

module.exports = readJsonFile;
