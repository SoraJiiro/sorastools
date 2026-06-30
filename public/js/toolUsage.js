import { applyActionsLabels } from "./utils.js";

const MOST_USED_SELECTOR = "[data-tools-most-used]";
const TOOL_ACTION_SELECTORS = {
  "base64": [
    "[data-b64-encode]",
    "[data-b64-decode]",
    "[data-b64-swap]",
    "[data-b64-copy]",
    "[data-b64-clear]",
  ],
  binary: [
    "[data-binary-encode]",
    "[data-binary-decode]",
    "[data-binary-swap]",
    "[data-binary-copy]",
    "[data-binary-clear]",
  ],
  hexadecimal: [
    "[data-hex-encode]",
    "[data-hex-decode]",
    "[data-hex-swap]",
    "[data-hex-copy]",
    "[data-hex-clear]",
  ],
  "json-formatter": [
    "[data-json-format]",
    "[data-json-minify]",
    "[data-json-validate]",
    "[data-json-copy]",
    "[data-json-clear]",
  ],
  "js-minifier": [
    "[data-jm-minify]",
    "[data-jm-copy]",
    "[data-jm-download]",
    "[data-jm-swap]",
    "[data-jm-clear]",
  ],
  "md-previewer": [
    "[data-md-copy-markdown]",
    "[data-md-copy-html]",
    "[data-md-export-markdown]",
    "[data-md-export-html]",
    "[data-md-clear]",
  ],
  "regex-tester": ["[data-regex-copy]"],
  "color-picker": [
    "[data-copy='hex']",
    "[data-copy='rgb']",
    "[data-copy='hsl']",
  ],
  "time-calculator": [
    "[data-time-duration-convert]",
    "[data-time-duration-swap]",
    "[data-time-duration-copy]",
    "[data-time-duration-clear]",
    "[data-time-timestamp-run]",
    "[data-time-timestamp-now]",
    "[data-time-timestamp-copy]",
    "[data-time-timestamp-clear]",
  ],
  "clip-path-generator": [
    "[data-clip-add-point]",
    "[data-clip-remove-point]",
    "[data-clip-copy]",
    "[data-clip-reset]",
  ],
  "file-converter": ["[data-fc-convert]", "[data-fc-reset]"],
};
let mostUsedRefreshTimer = null;

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrentToolId() {
  const match = window.location.pathname.match(/^\/tools\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getActionSelector(toolId) {
  return TOOL_ACTION_SELECTORS[toolId]?.join(", ") || "";
}

function isTrackedActionClick(event, toolId) {
  const selector = getActionSelector(toolId);

  if (!selector) return false;

  const actionElement = event.target.closest(selector);

  return Boolean(actionElement);
}

function renderMostUsedTools(containers, tools = []) {
  containers.forEach((container) => {
    if (!tools.length) {
      container.innerHTML = '<span class="nav-empty">Aucun tool utilisé</span>';
      return;
    }

    container.innerHTML = tools
      .map((tool) => {
        const name = escapeHtml(tool.name || "Tool");
        const url = escapeHtml(tool.url || "#");
        const icon = tool.icon || "";
        const count = Number(tool.submitCount || 0);
        const label = count > 0 ? `${name} - ${count} submit` : name;

        return `<a class="nav-tool-link" href="${url}" data-label="${escapeHtml(label)}">${icon}<span>${name}</span></a>`;
      })
      .join("");

    applyActionsLabels();
  });
}

export async function refreshMostUsedTools() {
  const containers = document.querySelectorAll(MOST_USED_SELECTOR);
  if (!containers.length) return;

  try {
    const response = await fetch("/api/tools/most-used", {
      headers: { Accept: "application/json" },
    });
    const data = await response.json();

    if (!response.ok || !data.success) throw new Error(data.message);

    renderMostUsedTools(containers, data.tools || []);
  } catch (error) {
    renderMostUsedTools(containers, []);
  }
}

function scheduleMostUsedRefresh() {
  window.clearTimeout(mostUsedRefreshTimer);
  mostUsedRefreshTimer = window.setTimeout(refreshMostUsedTools, 350);
}

export async function recordToolSubmit(toolId = getCurrentToolId()) {
  if (!toolId) return;

  try {
    const response = await fetch(`/api/tools/${encodeURIComponent(toolId)}/submit`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ submittedAt: new Date().toISOString() }),
    });

    if (response.ok) scheduleMostUsedRefresh();
  } catch (error) {
    // Les stats ne doivent jamais bloquer l'utilisation des tools.
  }
}

export function setupToolSubmitTracking() {
  const toolId = getCurrentToolId();
  if (!toolId) return;

  document.addEventListener("click", (event) => {
    if (!isTrackedActionClick(event, toolId)) return;

    recordToolSubmit(toolId);
  });
}

export function setupMostUsedTools() {
  refreshMostUsedTools();
}
