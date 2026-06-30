import { applyActionsLabels } from "./utils.js";

const MOST_USED_SELECTOR = "[data-tools-most-used]";
const LIMIT_KEY = "soraToolsUsageClickLimits";
const LIMIT_WINDOW = 60 * 60 * 1000;
const LIMIT_MAX = 5;
const TRACK_DELAY = 80;
const TOOL_ACTION_SELECTORS = {
  base64: ["[data-b64-encode]", "[data-b64-decode]", "[data-b64-swap]", "[data-b64-copy]", "[data-b64-clear]"],
  binary: ["[data-binary-encode]", "[data-binary-decode]", "[data-binary-swap]", "[data-binary-copy]", "[data-binary-clear]"],
  hexadecimal: ["[data-hex-encode]", "[data-hex-decode]", "[data-hex-swap]", "[data-hex-copy]", "[data-hex-clear]"],
  "json-formatter": ["[data-json-format]", "[data-json-minify]", "[data-json-validate]", "[data-json-copy]", "[data-json-clear]"],
  "js-minifier": ["[data-jm-minify]", "[data-jm-copy]", "[data-jm-download]", "[data-jm-swap]", "[data-jm-clear]"],
  "md-previewer": ["[data-md-copy-markdown]", "[data-md-copy-html]", "[data-md-export-markdown]", "[data-md-export-html]", "[data-md-clear]"],
  "regex-tester": ["[data-regex-copy]"],
  "color-picker": ["[data-copy='hex']", "[data-copy='rgb']", "[data-copy='hsl']"],
  "time-calculator": ["[data-time-duration-convert]", "[data-time-duration-swap]", "[data-time-duration-copy]", "[data-time-duration-clear]", "[data-time-timestamp-run]", "[data-time-timestamp-now]", "[data-time-timestamp-copy]", "[data-time-timestamp-clear]"],
  "clip-path-generator": ["[data-clip-add-point]", "[data-clip-remove-point]", "[data-clip-copy]", "[data-clip-reset]"],
  "file-converter": ["[data-fc-convert]", "[data-fc-reset]"],
};

let refreshTimer = null;
let clickSnapshot = null;

function escapeHtml(value = "") {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function getCurrentToolId() {
  const match = window.location.pathname.match(/^\/tools\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getTrackedActionElement(event, toolId) {
  const selector = TOOL_ACTION_SELECTORS[toolId]?.join(", ");
  return selector ? event.target.closest(selector) : null;
}

function getActionName(element) {
  return Object.keys(element?.dataset || {}).join(" ").toLowerCase();
}

function getElementValue(element) {
  if (!element) return "";
  if (Object.keys(element.dataset || {}).some((key) => key.endsWith("Status"))) return "";
  if (element.matches("button, [type='button'], [type='submit']")) return "";
  if (!element.matches("input, textarea, select")) return element.textContent || "";
  if (element.type === "checkbox" || element.type === "radio") return element.checked ? "checked" : "";
  if (element.type === "file") return Array.from(element.files || []).map((file) => `${file.name}:${file.size}`).join("|");
  return element.value || "";
}

function getToolState() {
  const root = document.querySelector("main") || document.body;
  return [...root.querySelectorAll("input, textarea, select, output, pre, code, [contenteditable='true'], [data-json-output]")]
    .map((element, index) => `${index}=${getElementValue(element)}`)
    .join("\n");
}

function hasValue(state = "") {
  return state.split("\n").some((line) => line.slice(line.indexOf("=") + 1).trim());
}

function getFirstValue(selectors) {
  for (const selector of selectors) {
    const value = getElementValue(document.querySelector(selector)).trim();
    if (value) return value;
  }
  return "";
}

function getCopySource(actionName) {
  if (actionName.includes("b64")) return getFirstValue(["[data-b64-output]"]);
  if (actionName.includes("binary")) return getFirstValue(["[data-binary-output]"]);
  if (actionName.includes("hex")) return getFirstValue(["[data-hex-output]"]);
  if (actionName.includes("json")) return getFirstValue(["[data-json-output]", "[data-json-input]"]);
  if (actionName.includes("jm")) return getFirstValue(["[data-jm-output]"]);
  if (actionName.includes("md") && actionName.includes("html")) return getFirstValue(["[data-md-preview]"]);
  if (actionName.includes("md")) return getFirstValue(["[data-md-input]"]);
  if (actionName.includes("regex")) return getFirstValue(["[data-regex-output]", "[data-regex-result]"]);
  if (actionName.includes("timeduration")) return getFirstValue(["[data-time-duration-output]", "[data-time-duration-result]"]);
  if (actionName.includes("timetimestamp")) return getFirstValue(["[data-time-timestamp-output]", "[data-time-timestamp-result]"]);
  if (actionName.includes("clip")) return getFirstValue(["[data-clip-output]"]);
  return getFirstValue(["output", "pre", "code", "textarea", "input"]);
}

function shouldCountAction(element, beforeState, beforeSuccessCount) {
  const actionName = getActionName(element);
  const afterState = getToolState();
  const afterSuccessCount = document.querySelectorAll("[data-type='success']").length;
  const isCopyLike = ["copy", "export", "download"].some((word) => actionName.includes(word));
  const isClearLike = ["clear", "reset"].some((word) => actionName.includes(word));
  const isSwapLike = actionName.includes("swap");

  if (isCopyLike) return Boolean(getCopySource(actionName));
  if (isClearLike) return hasValue(beforeState);
  if (isSwapLike) return hasValue(beforeState) && beforeState !== afterState;

  return afterSuccessCount > beforeSuccessCount || (beforeState !== afterState && (hasValue(beforeState) || hasValue(afterState)));
}

function isLocalLimitReached(toolId) {
  try {
    const now = Date.now();
    const store = JSON.parse(localStorage.getItem(LIMIT_KEY) || "{}");
    const clicks = (Array.isArray(store[toolId]) ? store[toolId] : []).filter((time) => now - time < LIMIT_WINDOW);
    if (clicks.length >= LIMIT_MAX) {
      store[toolId] = clicks;
      localStorage.setItem(LIMIT_KEY, JSON.stringify(store));
      return true;
    }
    clicks.push(now);
    store[toolId] = clicks;
    localStorage.setItem(LIMIT_KEY, JSON.stringify(store));
  } catch (error) {
    return false;
  }
  return false;
}

function renderMostUsedTools(containers, tools = []) {
  containers.forEach((container) => {
    if (!tools.length) {
      container.innerHTML = '<span class="nav-empty">Aucun tool utilisé</span>';
      return;
    }
    container.innerHTML = tools.map((tool) => {
      const name = escapeHtml(tool.name || "Tool");
      const label = Number(tool.submitCount || 0) > 0 ? `${name} - ${Number(tool.submitCount || 0)} submit` : name;
      return `<a class="nav-tool-link" href="${escapeHtml(tool.url || "#")}" data-label="${escapeHtml(label)}">${tool.icon || ""}<span>${name}</span></a>`;
    }).join("");
    applyActionsLabels();
  });
}

export async function refreshMostUsedTools() {
  const containers = document.querySelectorAll(MOST_USED_SELECTOR);
  if (!containers.length) return;
  try {
    const response = await fetch("/api/tools/most-used", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message);
    renderMostUsedTools(containers, data.tools || []);
  } catch (error) {
    renderMostUsedTools(containers, []);
  }
}

function scheduleMostUsedRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshMostUsedTools, 350);
}

export async function recordToolSubmit(toolId = getCurrentToolId()) {
  if (!toolId || isLocalLimitReached(toolId)) return;
  try {
    const response = await fetch(`/api/tools/${encodeURIComponent(toolId)}/submit`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
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
    const actionElement = getTrackedActionElement(event, toolId);
    if (!actionElement) return;
    clickSnapshot = {
      actionElement,
      beforeState: getToolState(),
      beforeSuccessCount: document.querySelectorAll("[data-type='success']").length,
    };
  }, true);

  document.addEventListener("click", (event) => {
    const actionElement = getTrackedActionElement(event, toolId);
    if (!actionElement || clickSnapshot?.actionElement !== actionElement) return;
    const { beforeState, beforeSuccessCount } = clickSnapshot;
    clickSnapshot = null;
    window.setTimeout(() => {
      if (shouldCountAction(actionElement, beforeState, beforeSuccessCount)) recordToolSubmit(toolId);
    }, TRACK_DELAY);
  });
}

export function setupMostUsedTools() {
  refreshMostUsedTools();
}
