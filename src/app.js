const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { NODE_MODULES_DIR, PUBLIC_DIR } = require("./config/paths");
const toolsApiRoutes = require("./routes/api/tools");
const markdownApiRoutes = require("./routes/api/markdown");
const codeFormatterApiRoutes = require("./routes/api/codeFormatter");
const fileConverterApiRoutes = require("./routes/api/fileConverter");
const usernameLookupApiRoutes = require("./routes/api/usernameLookup");
const cryptApiRoutes = require("./routes/api/crypt");
const youtubeDownloaderApiRoutes = require("./routes/api/youtubeDownloader");
const pageRoutes = require("./routes/pages");
const cronKeepAlive = require("./routes/api/cronKeepAlive");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

const VENDORS = {
  "qrcode-generator": "qrcode-generator/dist",
  prettier: "prettier",
  "prettier-plugin-sql": "prettier-plugin-sql/lib",
  "prettier-plugin-java": "prettier-plugin-java/dist",
  "@prettier/plugin-php": "@prettier/plugin-php",
  terser: "terser/dist",
  "javascript-obfuscator": "javascript-obfuscator/dist",
  acorn: "acorn/dist",
  "@emailjs/browser": "@emailjs/browser/dist",
  "highlight.js": "highlight.js",
};
for (const [name, dir] of Object.entries(VENDORS)) {
  app.use(`/vendor/${name}`, express.static(path.join(NODE_MODULES_DIR, dir)));
}

app.use(toolsApiRoutes);
app.use(markdownApiRoutes);
app.use(codeFormatterApiRoutes);
app.use(fileConverterApiRoutes);
app.use(usernameLookupApiRoutes);
app.use(cryptApiRoutes);
app.use(youtubeDownloaderApiRoutes);
app.use(cronKeepAlive);
app.use(pageRoutes);

app.listen(PORT, () => {
  console.log(`SorasTools lancé sur http://localhost:${PORT}`);
});
