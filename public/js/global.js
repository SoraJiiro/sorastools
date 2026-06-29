import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";

function highlightCode(root = document) {
  if (!window.hljs) return;

  root.querySelectorAll("pre code:not(.hljs)").forEach((code) => {
    window.hljs.highlightElement(code);
  });
}

window.applyHighlightJs = highlightCode;
document.addEventListener("soratools:content-updated", (event) => {
  highlightCode(event.detail?.root || document);
});

initFaKit();
setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels();
highlightCode();
