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

app.use(
  "/vendor/prettier",
  express.static(path.join(NODE_MODULES_DIR, "prettier")),
);
app.use(
  "/vendor/prettier/plugins",
  express.static(path.join(NODE_MODULES_DIR, "prettier", "plugins")),
);
app.use(
  "/vendor/prettier-plugin-sql",
  express.static(path.join(NODE_MODULES_DIR, "prettier-plugin-sql", "lib")),
);
app.use(
  "/vendor/prettier-plugin-java",
  express.static(path.join(NODE_MODULES_DIR, "prettier-plugin-java", "dist")),
);
app.use(
  "/vendor/@prettier/plugin-php",
  express.static(path.join(NODE_MODULES_DIR, "@prettier", "plugin-php")),
);
app.use(
  "/vendor/js-beautify",
  express.static(path.join(NODE_MODULES_DIR, "js-beautify")),
);
app.use(
  "/vendor/sql-formatter",
  express.static(path.join(NODE_MODULES_DIR, "sql-formatter", "dist")),
);
app.use(
  "/vendor/terser",
  express.static(path.join(NODE_MODULES_DIR, "terser", "dist")),
);
app.use(
  "/vendor/javascript-obfuscator",
  express.static(path.join(NODE_MODULES_DIR, "javascript-obfuscator", "dist")),
);
app.use(
  "/vendor/acorn",
  express.static(path.join(NODE_MODULES_DIR, "acorn", "dist")),
);
app.use(
  "/vendor/@emailjs/browser",
  express.static(path.join(NODE_MODULES_DIR, "@emailjs", "browser", "dist")),
);

app.use(
  "/vendor/highlight.js",
  express.static(path.join(NODE_MODULES_DIR, "highlight.js")),
);

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
