const express = require("express");
let hljs = null;
const { marked } = require("marked");

try {
  hljs = require("highlight.js");
} catch (error) {
  hljs = require("hljs");
}

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
      language: codeToken.lang || "",
    };
  }

  return {
    code: codeToken || "",
    language: String(languageToken || "").split(/\s+/)[0],
  };
}

function highlightCode(code, language) {
  if (!hljs) return escapeHtml(code);

  try {
    if (language && typeof hljs.getLanguage === "function" && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } catch (error) {
        return hljs.highlight(language, code, true).value;
      }
    }

    if (typeof hljs.highlightAuto === "function") {
      return hljs.highlightAuto(code).value;
    }
  } catch (error) {
    return escapeHtml(code);
  }

  return escapeHtml(code);
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
