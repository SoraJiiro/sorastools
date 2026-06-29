const express = require("express");
const { marked } = require("marked");

const router = express.Router();

marked.setOptions({
  breaks: true,
  gfm: true,
});

router.post("/api/markdown/preview", (req, res) => {
  const markdown = typeof req.body.markdown === "string" ? req.body.markdown : "";
  const html = marked.parse(markdown);

  res.json({ success: true, html });
});

module.exports = router;
