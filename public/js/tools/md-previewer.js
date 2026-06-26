import { copyToClipboard, setStatus } from "../utils.js";

const mdInput = document.querySelector("[data-md-input]");
const mdPreview = document.querySelector("[data-md-preview]");
const mdStatus = document.querySelector("[data-md-status]");
const copyMarkdownButton = document.querySelector("[data-md-copy-markdown]");
const copyHtmlButton = document.querySelector("[data-md-copy-html]");
const clearButton = document.querySelector("[data-md-clear]");

let lastHtml = "";
let renderTimeout = null;

function setMdStatus(message, type = "default") {
  setStatus(mdStatus, message, type);
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
    setMdStatus("Préview générée en direct.", "success");
  } catch (error) {
    setMdStatus(`Erreur : ${error.message}`, "error");
  }
}

function scheduleRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(renderMarkdown, 250);
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

    await copyToClipboard(lastHtml);
    setMdStatus("HTML copié dans le presse-papiers.", "success");
  });

  clearButton?.addEventListener("click", () => {
    mdInput.value = "";
    mdPreview.innerHTML = "";
    lastHtml = "";
    setMdStatus("En attente de Markdown.", "default");
  });
}

setupMarkdownPreviewer();
