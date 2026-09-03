import {
  copyToClipboard,
  downloadTextFile,
  escapeHtml,
  setStatus,
} from "../utils.js";

const mdInput = document.querySelector("[data-md-input]");
const mdPreview = document.querySelector("[data-md-preview]");
const mdStatus = document.querySelector("[data-md-status]");
const copyMarkdownButton = document.querySelector("[data-md-copy-markdown]");
const copyHtmlButton = document.querySelector("[data-md-copy-html]");
const exportMarkdownButton = document.querySelector(
  "[data-md-export-markdown]",
);
const exportHtmlButton = document.querySelector("[data-md-export-html]");
const clearButton = document.querySelector("[data-md-clear]");

let lastHtml = "";
let renderTimeout = null;

function setMdStatus(message, type = "default") {
  setStatus(mdStatus, message, type);
}

function getExportDate() {
  return new Date().toISOString().slice(0, 10);
}

function getSafeFilename(extension) {
  return `sorastool-markdown-${getExportDate()}.${extension}`;
}

function buildFullHtmlDocument(bodyContent) {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Markdown - SoraTool</title>
    <style>
      body {
        max-width: 900px;
        margin: 40px auto;
        padding: 0 20px;
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #111827;
      }

      pre {
        padding: 16px;
        overflow: auto;
        background: #111827;
        color: #f9fafb;
        border-radius: 10px;
      }

      code {
        font-family: Consolas, Monaco, monospace;
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-title,
      .hljs-section {
        color: #ff7a00;
      }

      .hljs-string,
      .hljs-attribute,
      .hljs-symbol,
      .hljs-bullet {
        color: #16a34a;
      }

      .hljs-comment,
      .hljs-quote {
        color: #6b7280;
      }

      blockquote {
        margin-left: 0;
        padding-left: 16px;
        color: #4b5563;
        border-left: 4px solid #ff7a00;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 8px 10px;
        border: 1px solid #d1d5db;
      }
    </style>
  </head>
  <body>
${bodyContent}
  </body>
</html>`;
}

async function renderMarkdown() {
  if (!mdInput || !mdPreview) return;

  try {
    const response = await fetch("/api/markdown/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ markdown: mdInput.value }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Impossible de générer la preview.");
    }

    lastHtml = data.html;
    mdPreview.innerHTML = lastHtml;
    document.dispatchEvent(
      new CustomEvent("sorastool:content-updated", {
        detail: { root: mdPreview },
      }),
    );
    setMdStatus("Préview générée en direct.", "success");
  } catch (error) {
    setMdStatus(`Erreur : ${error.message}`, "error");
  }
}

function scheduleRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(renderMarkdown, 250);
}

function exportMarkdown() {
  const markdown = mdInput.value;

  if (!markdown.trim()) {
    setMdStatus("Aucun Markdown à exporter.", "warning");
    return;
  }

  downloadTextFile(markdown, getSafeFilename("md"), "text/markdown");
  setMdStatus("Fichier .md exporté.", "success");
}

async function exportHtml() {
  if (!mdInput.value.trim()) {
    setMdStatus("Aucun HTML à exporter.", "warning");
    return;
  }

  if (!lastHtml.trim()) {
    await renderMarkdown();
  }

  const renderedHtml = mdPreview.innerHTML || lastHtml || escapeHtml(mdInput.value);
  const htmlDocument = buildFullHtmlDocument(renderedHtml);
  downloadTextFile(htmlDocument, getSafeFilename("html"), "text/html");
  setMdStatus("Fichier .html exporté.", "success");
}

function setupMarkdownPreviewer() {
  if (!mdInput || !mdPreview) return;

  renderMarkdown();

  mdInput.addEventListener("input", scheduleRender);

  copyMarkdownButton?.addEventListener("click", async () => {
    if (!mdInput.value.trim()) {
      setMdStatus("Aucun Markdown à copier.", "warning");
      return;
    }

    await copyToClipboard(mdInput.value);
    setMdStatus("Markdown copié dans le presse-papiers.", "success");
  });

  copyHtmlButton?.addEventListener("click", async () => {
    if (!lastHtml.trim()) {
      setMdStatus("Aucun HTML à copier.", "warning");
      return;
    }

    await copyToClipboard(mdPreview.innerHTML || lastHtml);
    setMdStatus("HTML copié dans le presse-papiers.", "success");
  });

  exportMarkdownButton?.addEventListener("click", exportMarkdown);
  exportHtmlButton?.addEventListener("click", exportHtml);

  clearButton?.addEventListener("click", () => {
    mdInput.value = "";
    mdPreview.innerHTML = "";
    lastHtml = "";
    setMdStatus("En attente de Markdown.", "default");
  });
}

setupMarkdownPreviewer();
