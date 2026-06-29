import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";

const HLJS_SCRIPT_URL =
  "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js";

function highlightAllCodeTags() {
  if (!window.hljs) return;

  document.querySelectorAll("code:not([data-hljs-applied])").forEach((code) => {
    window.hljs.highlightElement(code);
    code.dataset.hljsApplied = "true";
  });
}

function loadHighlightJs() {
  if (window.hljs) {
    highlightAllCodeTags();
    return;
  }

  const existingScript = document.querySelector(`script[src="${HLJS_SCRIPT_URL}"]`);

  if (existingScript) {
    existingScript.addEventListener("load", highlightAllCodeTags, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = HLJS_SCRIPT_URL;
  script.defer = true;
  script.addEventListener("load", highlightAllCodeTags, { once: true });
  document.head.appendChild(script);
}

window.applyHighlightJs = highlightAllCodeTags;
document.addEventListener("soratools:content-updated", highlightAllCodeTags);

initFaKit();
setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels();
loadHighlightJs();
