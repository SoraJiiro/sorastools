const express = require("express");
const readJsonFile = require("../../utils/readJsonFile");
const { TOOLS_FILE } = require("../../config/paths");

const router = express.Router();

async function getTools() {
  const data = await readJsonFile(TOOLS_FILE, []);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tools)) return data.tools;

  return [];
}

router.get("/api/tools", async (req, res) => {
  const tools = await getTools();
  res.json({ success: true, tools });
});

module.exports = router;
