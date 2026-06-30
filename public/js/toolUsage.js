import { applyActionsLabels } from "./utils.js";

const MOST_USED_SELECTOR = "[data-tools-most-used]";
const ACTION_TRACKING_DELAY = 80;
const LOCAL_LIMIT_STORAGE_KEY = "soraToolsUsageClickLimits";
const LOCAL_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const LOCAL_LIMIT_MAX_CLICKS = 5;
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
let trackedClickSnapshot = null;

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

function getTrackedActionElement(event, toolId) {
  const selector = getActionSelector(toolId);

  if (!selector) return null;

  return event.target.closest(selector);
}

function getElementTrackingName(element) {
  if (!element) return "";

  const dataKey = Object.keys(element.dataset || {})[0];
  if (dataKey) return `data-${dataKey}`;

  return element.name || element.id || element.tagName.toLowerCase();
}

function getActionName(actionElement) {
  return Object.keys(actionElement?.dataset || {}).join(" ").toLowerCase();
}

function isToolStatusElement(element) {
  return Object.keys(element.dataset || {}).some((key) => key.endsWith("Status"));
}

function getElementValue(element) {
  if (!element || isToolStatusElement(element)) return "";
  if (element.matches("button, [type='button'], [type='submit']")) return "";

  if (element.matches("input, textarea, select")) {
    if (element.type === "checkbox" || element.type === "radio") {
      return element.checked ? "checked" : "";
    }

    if (element.type === "file") {
      return Array.from(element.files || [])
        .map((file) => `${file.name}:${file.size}`)
        .join("|");
    }

    return element.value || "";
  }

  return element.textContent || "";
}

function getToolRoot() {
  return document.querySelector("main") || document.body;
}

function getToolState() {
  const root = getToolRoot();
  const values = [];
  const selector = [
    "input",
    "textarea",
    "select",
    "output",
    "pre",
    "code",
    "[contenteditable='true']",
    "[data-json-output]",
  ].join(", ");

  root.querySelectorAll(selector).forEach((element, index) => {
    const value = getElementValue(element);
    values.push(`${index}:${getElementTrackingName(element)}=${value}`);
  });

  return values.join("\n");
}

function getSuccessfulStatusCount() {
  return document.querySelectorAll("[data-type='success']").length;
}

function hasMeaningfulValue(state = "") {
  return state
    .split("\n")
    .some((line) => {
      const value = line.slice(line.indexOf("=") + 1).trim();
      return Boolean(value);
    });
}

function actionContains(actionName, words = []) {
  return words.some((word) => actionName.includes(word));
}

function isCopyLikeAction(actionName) {
  return actionContains(actionName, ["copy", "export", "download"]);
}

function isClearLikeAction(actionName) {
  return actionContains(actionName, ["clear", "reset"]);
}

function isSwapLikeAction(actionName) {
  return actionName.includes("swap");
}

function isUsageLocalLimitReached(toolId) {
  try {
    const now = Date.now();
    const usageLimits = JSON.parse(localStorage.getItem(LOCAL_LIMIT_STORAGE_KEY) || "{}");
    const clicks = Array.isArray(usageLimits[toolId]) ? usageLimits[toolId] : [];
    const recentClicks = clicks.filter((timestamp) => now - timestamp < LOCAL_LIMIT_WINDOW_MS);

    if (recentClicks.length >= LOCAL_LIMIT_MAX_CLICKS) {
      usageLimits[toolId] = recentClicks;
      localStorage.setItem(LOCAL_LIMIT_STORAGE_KEY, JSON.stringify(usageLimits));
      return true;
    }

    recentClicks.push(now);
    usageLimits[toolId] = recentClicks;
    localStorage.setItem(LOCAL_LIMIT_STORAGE_KEY, JSON.stringify(usageLimits));
    return false;
  } catch (error) {
    return false;
  }
}

function shouldCountTrackedAction(actionElement, beforeState, beforeSuccessCount) {
  const actionName = getActionName(actionElement);
  const afterState = getToolState();
  const afterSuccessCount = getSuccessfulStatusCount();
  const hadUsefulValueBefore = hasMeaningfulValue(beforeState);
  const hasUsefulValueAfter = hasMeaningfulValue(afterState);
  const stateChanged = beforeState !== afterState;
  const gotSuccess = afterSuccessCount > beforeSuccessCount;

  if (isCopyLikeAction(actionName)) return hadUsefulValueBefore;
  if (isClearLikeAction(actionName)) return hadUsefulValueBefore;
  if (isSwapLikeAction(actionName)) return hadUsefulValueBefore && stateChanged;

  return gotSuccess || (stateChanged && (hadUsefulValueBefore || hasUsefulValueAfter));
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
  if (!toolId || isUsageLocalLimitReached(toolId)) return;

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

  document.addEventListener(
    "click",
    (event) => {
      const actionElement = getTrackedActionElement(event, toolId);
      if (!actionElement) return;

      trackedClickSnapshot = {
        actionElement,
        beforeState: getToolState(),
        beforeSuccessCount: getSuccessfulStatusCount(),
      };
    },
    true,
  );

  document.addEventListener("click", (event) => {
    const actionElement = getTrackedActionElement(event, toolId);
    if (!actionElement || trackedClickSnapshot?.actionElement !== actionElement) return;

    const { beforeState, beforeSuccessCount } = trackedClickSnapshot;
    trackedClickSnapshot = null;

    window.setTimeout(() => {
      if (!shouldCountTrackedAction(actionElement, beforeState, beforeSuccessCount)) return;

      recordToolSubmit(toolId);
    }, ACTION_TRACKING_DELAY);
  });
}

export function setupMostUsedTools() {
  refreshMostUsedTools();
}
