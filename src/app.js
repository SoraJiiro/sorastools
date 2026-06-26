const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const TOOLS_FILE = path.join(PUBLIC_DIR, "data", "toolStorage.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

async function getTools() {
  try {
    const fileContent = await fs.readFile(TOOLS_FILE, "utf-8");
    const data = JSON.parse(fileContent);
    return Array.isArray(data.tools) ? data.tools : [];
  } catch (error) {
    console.error("Erreur lors du chargement des outils :", error);
    return [];
  }
}

app.get("/api/tools", async (req, res) => {
  const tools = await getTools();
  res.json({ success: true, tools });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/tools/color-picker", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "tools", "color-picker.html"));
});

app.get("/tools/json-formatter", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "tools", "json-formatter.html"));
});

app.get("/tools/regex-tester", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "tools", "regex-tester.html"));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.listen(PORT, () => {
  console.log(`SoraTools lancé sur http://localhost:${PORT}`);
});
