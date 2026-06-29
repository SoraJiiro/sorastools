const express = require("express");
const hljs = require("highlight.js");
const { marked } = require("marked");

const router = express.Router();
const renderer = new marked.Renderer();

renderer.code = function renderCode(token) {
  const code = typeof token === "string" ? token : token.text || "";
  const highlighted = hljs.highlightAuto(code).value;

  return `<pre><code class="hljs">${highlighted}</code></pre>`;
};

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

router.post("/api/markdown/preview", (req, res) => {
  const markdown = typeof req.body.markdown === "string" ? req.body.markdown : "";
  const html = marked.parse(markdown);

  res.json({ success: true, html });
});

module.exports = router;
