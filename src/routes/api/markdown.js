const express = require("express");
const hljs = require("highlight.js");
const { marked } = require("marked");

const router = express.Router();
const renderer = new marked.Renderer();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderer.code = function renderCode(codeToken, languageToken = "") {
  const code = typeof codeToken === "object" && codeToken !== null
    ? codeToken.text || ""
    : codeToken || "";

  const language = String(
    typeof codeToken === "object" && codeToken !== null
      ? codeToken.lang || ""
      : languageToken || "",
  ).split(/\s+/)[0];

  try {
    const highlighted = language && hljs.getLanguage(language)
      ? hljs.highlight(code, { language, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value;

    const languageClass = language ? ` language-${escapeHtml(language)}` : "";
    return `<pre><code class="hljs${languageClass}">${highlighted}</code></pre>`;
  } catch (error) {
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
  }
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
