import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";

function highlightCode(root = document) {
  if (!window.hljs) return;

  root.querySelectorAll("pre code").forEach((code) => {
    code.removeAttribute("data-highlighted");
    window.hljs.highlightElement(code);
  });
}

function setupHighlightJs() {
  window.applyHighlightJs = highlightCode;

  document.addEventListener("soratools:content-updated", (event) => {
    highlightCode(event.detail?.root || document);
  });

  const hljsScript = document.querySelector("script[src*='highlight']");

  if (window.hljs) {
    highlightCode();
    return;
  }

  hljsScript?.addEventListener("load", () => highlightCode(), { once: true });
  window.addEventListener("load", () => highlightCode(), { once: true });
}

initFaKit();
setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels();
setupHighlightJs();
