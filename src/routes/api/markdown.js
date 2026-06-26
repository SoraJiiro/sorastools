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

function normalizeCodeToken(codeToken, languageToken = "") {
  if (typeof codeToken === "object" && codeToken !== null) {
    return {
      code: codeToken.text || "",
      language: String(codeToken.lang || "").split(/\s+/)[0],
    };
  }

  return {
    code: codeToken || "",
    language: String(languageToken || "").split(/\s+/)[0],
  };
}

function highlightCode(code, language) {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    }

    return hljs.highlightAuto(code).value;
  } catch (error) {
    return escapeHtml(code);
  }
}

renderer.code = function renderCode(codeToken, languageToken) {
  const { code, language } = normalizeCodeToken(codeToken, languageToken);
  const highlightedCode = highlightCode(code, language);
  const languageClass = language ? ` language-${escapeHtml(language)}` : "";

  return `<pre><code class="hljs${languageClass}">${highlightedCode}</code></pre>`;
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
