const express = require("express");
const path = require("path");
const { NODE_MODULES_DIR, PUBLIC_DIR } = require("./config/paths");
const toolsApiRoutes = require("./routes/api/tools");
const markdownApiRoutes = require("./routes/api/markdown");
const pageRoutes = require("./routes/pages");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use(
  "/vendor/highlight.js",
  express.static(path.join(NODE_MODULES_DIR, "highlight.js")),
);

app.use(toolsApiRoutes);
app.use(markdownApiRoutes);
app.use(pageRoutes);

app.listen(PORT, () => {
  console.log(`SoraTools lancé sur http://localhost:${PORT}`);
});
