const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function getTools() {
  try {
    const res = await fetch("/data/toolStorage.json");
    const data = await res.json();
    return data.tools;
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
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/tools/color-picker", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tools", "color-picker.html"));
});

app.get("/tools/json-formatter", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tools", "json-formatter.html"));
});

app.get("/tools/regex-tester", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tools", "regex-tester.html"));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`SoraTools lancé sur http://localhost:${PORT}`);
});
