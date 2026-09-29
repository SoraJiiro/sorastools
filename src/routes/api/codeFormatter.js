const express = require("express");

const router = express.Router();
const prettierPromise = import("prettier");
const pluginsPromise = Promise.all([
  import("prettier-plugin-sql").then((module) => module.default),
  import("prettier-plugin-java").then((module) => module.default),
  import("@prettier/plugin-php").then((module) => module.default ?? module),
]);
const parsers = {
  css: "css",
  html: "html",
  javascript: "babel",
  json: "json",
  php: "php",
  java: "java",
  sql: "sql",
};

router.post("/api/code-formatter/format", async (req, res) => {
  const { code, language, indent } = req.body || {};
  const parser = parsers[language];
  if (typeof code !== "string" || !parser) {
    return res.status(400).json({ error: "Code ou langage invalide." });
  }

  try {
    const [{ default: prettier }, plugins] = await Promise.all([
      prettierPromise,
      pluginsPromise,
    ]);
    const formatted = await prettier.format(code, {
      parser,
      plugins,
      tabWidth: Number(indent) || 2,
      useTabs: indent === "tab",
    });
    return res.json({ formatted });
  } catch (error) {
    const message = error.message.replace(/\u001B\[[0-9;]*m/g, "");
    return res.status(400).json({ error: message });
  }
});

module.exports = router;
