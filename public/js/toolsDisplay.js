import { applyActionsLabels } from "./utils.js";

const toolsGrid = document.querySelector("[data-tools-grid]");

function sortTools(a, b) {
  const aUpdateDate = a.querySelector(".update-date")?.textContent || "";
  const bUpdateDate = b.querySelector(".update-date")?.textContent || "";
  const aUploadDate = a.querySelector(".upload-date")?.textContent || "";
  const bUploadDate = b.querySelector(".upload-date")?.textContent || "";
  const aReady = a.classList.contains("tool-card--soon") ? 1 : 0;
  const bReady = b.classList.contains("tool-card--soon") ? 1 : 0;

  if (aReady !== bReady) return aReady - bReady;

  if (aUpdateDate && bUpdateDate) {
    const aDate = new Date(aUpdateDate);
    const bDate = new Date(bUpdateDate);
    if (aDate > bDate) return -1;
    if (aDate < bDate) return 1;
  }

  if (aUploadDate && bUploadDate) {
    const aDate = new Date(aUploadDate);
    const bDate = new Date(bUploadDate);
    if (aDate > bDate) return -1;
    if (aDate < bDate) return 1;
  }

  return 0;
}

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
        const optionalHrefClass = isReady ? "" : "href--soon";
        const updateDate = tool.updatedAt
          ? new Date(tool.updatedAt).toLocaleDateString()
          : null;
        const uploadDate = tool.createdAt
          ? new Date(tool.createdAt).toLocaleDateString()
          : null;

        return `
          <article class="tool-card ${isReady ? "" : "tool-card--soon"}">
            <div class="tool-card__icon">${tool.icon || ""}</div>
            <span class="tool-card__category">${tool.category}</span>
            <h3>${tool.name}</h3>
            <p>${tool.description}</p>
            <a class="internal-link ${optionalHrefClass}" href="${href}" data-label="${linkLabel}">${isReady ? "Ouvrir" : "À venir"}</a>
            <p class="tool-card__dates">
              ${uploadDate ? `<span class="upload-date" title="Date d'ajout : ${uploadDate}" aria-label="Date d'ajout : ${uploadDate}">${uploadDate}</span>` : ""}
              ${updateDate ? `<span class="update-date" title="Date de mise à jour : ${updateDate}" aria-label="Date de mise à jour : ${updateDate}">${updateDate}</span>` : ""}
            </p>
          </article>
        `;
      })
      .join("");

    applyActionsLabels();

    let allChildren = toolsGrid.querySelectorAll(".tool-card");
    toolsGrid.innerHTML = "";
    allChildren = Array.from(allChildren);
    allChildren.sort(sortTools);
    allChildren.forEach((child) => {
      if (child.classList.contains("tool-card--soon")) {
        child.querySelector("a")?.setAttribute("tabindex", "-1");
      }
    });
    allChildren.forEach((child) => toolsGrid.appendChild(child));
  } catch (error) {
    toolsGrid.innerHTML = "<p>Impossible de charger les tools.</p>";
  }
}

displayTools();
