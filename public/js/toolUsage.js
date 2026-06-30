import { applyActionsLabels } from "./utils.js";

const MOST_USED_SELECTOR = "[data-tools-most-used]";
const SUBMIT_TRACKING_SELECTOR = [
  "button",
  "input[type='submit']",
  "input[type='button']",
  ".btn",
].join(", ");
const SUBMIT_ACTION_REGEX =
  /\b(formatter|format|formater|minifier|minify|valider|validate|convertir|convert|encoder|decoder|décoder|traduire|translate|tester|test|generer|générer|calculer|calculate|picker|choisir|preview|previsualiser|prévisualiser)\b/i;
const IGNORED_ACTION_REGEX =
  /\b(copier|copy|telecharger|télécharger|download|vider|clear|reset|reinitialiser|réinitialiser|supprimer|delete|retour|back|ouvrir|open|contact|suggest)\b/i;
let mostUsedRefreshTimer = null;

function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

function shouldTrackAction(element) {
  const actionText = normalizeText(
    `${element.textContent || ""} ${element.value || ""} ${element.dataset.label || ""}`,
  );

  if (!actionText || IGNORED_ACTION_REGEX.test(actionText)) return false;

  return SUBMIT_ACTION_REGEX.test(actionText);
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
    const actionElement = event.target.closest(SUBMIT_TRACKING_SELECTOR);
    if (!actionElement || !shouldTrackAction(actionElement)) return;

    recordToolSubmit(toolId);
  });

  document.addEventListener("submit", () => {
    recordToolSubmit(toolId);
  });
}

export function setupMostUsedTools() {
  refreshMostUsedTools();
}
