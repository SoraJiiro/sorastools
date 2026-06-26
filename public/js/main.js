import { applyActionsLabels } from "./utils.js";

const toolsGrid = document.querySelector("[data-tools-grid]");

async function displayTools() {
  if (!toolsGrid) return;

  try {
    const response = await fetch("/api/tools");
    const data = await response.json();

    toolsGrid.innerHTML = data.tools
      .map((tool) => {
        const isReady = tool.status === "ready";
        const statusText = isReady ? "Disponible" : "Bientôt";
        const href = isReady ? tool.url : "#tools";
        const linkLabel = isReady
          ? `Ouvrir l'outil ${tool.name}`
          : `Outil ${tool.name} bientôt disponible`;

        return `
          <article class="tool-card ${isReady ? "" : "tool-card--soon"}">
            <span class="tool-card__category">${tool.category}</span>
            <h3>${tool.name}</h3>
            <p>${tool.description}</p>
            <span class="tool-card__status">${statusText}</span>
            <a class="tool-card__link" href="${href}" data-label="${linkLabel}">${isReady ? "Ouvrir" : "À venir"}</a>
          </article>
        `;
      })
      .join("");

    applyActionsLabels();
  } catch (error) {
    toolsGrid.innerHTML = "<p>Impossible de charger les tools.</p>";
  }
}

displayTools();
