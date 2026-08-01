import { applyActionsLabels, setStatus } from "../utils.js";

const lookupForm = document.querySelector("[data-lookup-form]");
const usernameInput = document.querySelector("[data-lookup-username]");
const lookupStatus = document.querySelector("[data-lookup-status]");
const lookupResults = document.querySelector("[data-lookup-results]");

function renderResults(results = []) {
  if (!lookupResults) return;

  if (!results.length) {
    lookupResults.innerHTML = "";
    return;
  }

  const sortedResults = [...results].sort((a, b) => {
    const order = { taken: 0, uncertain: 1, available: 2, unknown: 3 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });

  lookupResults.innerHTML = sortedResults
    .map((result) => {
      const label =
        result.status === "taken"
          ? "Probable"
          : result.status === "available"
            ? "Peu probable"
            : result.status === "uncertain"
              ? "Incertain"
              : "Inconnu";
      const className =
        result.status === "taken"
          ? "is-taken"
          : result.status === "available"
            ? "is-available"
            : result.status === "uncertain"
              ? "is-unknown"
              : "is-unknown";

      return `
        <article class="lookup-result ${className}">
          <div class="lookup-result__header">
            <h3>${result.name}</h3>
            <span>${label}</span>
          </div>
          <p>${result.message}</p>
          ${result.url ? `<a href="${result.url}" target="_blank" rel="noreferrer">Ouvrir la page</a>` : ""}
        </article>
      `;
    })
    .join("");
}

async function runLookup(username) {
  if (!lookupStatus || !lookupResults) return;

  setStatus(lookupStatus, "Vérification en cours…", "default");
  lookupResults.innerHTML = "";

  try {
    const response = await fetch("/api/username-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      setStatus(
        lookupStatus,
        data.message || "Échec de la recherche.",
        "error",
      );
      return;
    }

    renderResults(data.results || []);
    setStatus(
      lookupStatus,
      `${data.results.length} vérification${data.results.length > 1 ? "s" : ""} réalisée${data.results.length > 1 ? "s" : ""}.`,
      "success",
    );
  } catch (error) {
    setStatus(
      lookupStatus,
      "La requête a échoué. Réessayez plus tard.",
      "error",
    );
  }
}

function setupLookupTool() {
  if (!lookupForm) return;

  applyActionsLabels();

  lookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = usernameInput?.value?.trim();

    if (!username) {
      setStatus(
        lookupStatus,
        "Veuillez entrer un pseudo à vérifier.",
        "warning",
      );
      return;
    }

    runLookup(username);
  });
}

setupLookupTool();
