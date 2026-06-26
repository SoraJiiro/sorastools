const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const tools = [
  {
    id: "color-picker",
    name: "Color Picker",
    category: "Design",
    description: "Choisis une couleur et convertis-la en HEX, RGB et HSL.",
    url: "/tools/color-picker",
    status: "ready",
  },
  {
    id: "json-formatter",
    name: "JSON Formatter",
    category: "Dev",
    description: "Formate, valide et minifie du JSON.",
    url: "/tools/json-formatter",
    status: "ready",
  },
  {
    id: "youtube-downloader",
    name: "YouTube Downloader",
    category: "Médias",
    description: "Télécharge une vidéo YouTube en MP3 ou MP4.",
    url: "#",
    status: "soon",
  },
  {
    id: "js-minifier",
    name: "JS Minifier",
    category: "Dev",
    description: "Minifie du JavaScript avec Terser / minify.",
    url: "#",
    status: "soon",
  },
  {
    id: "base64",
    name: "Base64 Encoder / Decoder",
    category: "Dev",
    description: "Encode ou décode rapidement une chaîne en Base64.",
    url: "#",
    status: "soon",
  },
  {
    id: "template-generator",
    name: "Template Generator",
    category: "Générateurs",
    description: "Génère des templates HTML, README, Express ou .env.",
    url: "#",
    status: "soon",
  },
  {
    id: "file-converter",
    name: "File Converter",
    category: "Fichiers",
    description: "Convertis des fichiers image, texte ou données.",
    url: "#",
    status: "soon",
  },
];

app.get("/api/tools", (req, res) => {
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

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`SoraTools lancé sur http://localhost:${PORT}`);
});
