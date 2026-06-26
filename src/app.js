const express = require("express");
const fs = require("fs").promises;
const { marked } = require("marked");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const TOOLS_FILE = path.join(__dirname, "data", "toolStorage.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

marked.setOptions({
  breaks: true,
  gfm: true,
});

async function getTools() {
  try {
    const fileContent = await fs.readFile(TOOLS_FILE, "utf-8");
    const data = JSON.parse(fileContent);

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.tools)) return data.tools;

    return [];
  } catch (error) {
    console.error("Erreur lors du chargement des outils :", error);
    return [];
  }
}

app.get("/api/tools", async (req, res) => {
  const tools = await getTools();
  res.json({ success: true, tools });
});

app.post("/api/markdown/preview", (req, res) => {
  const markdown = typeof req.body.markdown === "string" ? req.body.markdown : "";
  const html = marked.parse(markdown);

  res.json({ success: true, html });
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

app.get("/tools/md-previewer", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "tools", "md-previewer.html"));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.listen(PORT, () => {
  console.log(`SoraTools lancé sur http://localhost:${PORT}`);
});
