const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { NODE_MODULES_DIR, PUBLIC_DIR } = require("./config/paths");
const toolsApiRoutes = require("./routes/api/tools");
const markdownApiRoutes = require("./routes/api/markdown");
const fileConverterApiRoutes = require("./routes/api/fileConverter");
const usernameLookupApiRoutes = require("./routes/api/usernameLookup");
const cryptApiRoutes = require("./routes/api/crypt");
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
app.use(fileConverterApiRoutes);
app.use(usernameLookupApiRoutes);
app.use(cryptApiRoutes);
app.use(pageRoutes);

app.listen(PORT, () => {
  console.log(`SoraTool lancé sur http://localhost:${PORT}`);
});
