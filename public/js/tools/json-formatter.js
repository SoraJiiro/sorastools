import { copyToClipboard, setStatus } from "../utils.js";

const jsonInput = document.querySelector("[data-json-input]");
const jsonOutput = document.querySelector("[data-json-output]");
const jsonStatus = document.querySelector("[data-json-status]");

function setJsonStatus(message, type = "default") {
  setStatus(jsonStatus, message, type);
}

function parseJsonInput() {
  if (!jsonInput) return null;

  const value = jsonInput.value.trim();

  if (!value) {
    setJsonStatus("Colle du JSON avant de lancer une action.", "warning");
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    setJsonStatus(`JSON invalide : ${error.message}`, "error");
    return null;
  }
}

function setupJsonFormatter() {
  if (!jsonInput || !jsonOutput) return;

  const formatButton = document.querySelector("[data-json-format]");
  const minifyButton = document.querySelector("[data-json-minify]");
  const validateButton = document.querySelector("[data-json-validate]");
  const clearButton = document.querySelector("[data-json-clear]");
  const copyButton = document.querySelector("[data-json-copy]");

  formatButton?.addEventListener("click", () => {
    const parsedJson = parseJsonInput();
    if (!parsedJson) return;

    jsonOutput.value = JSON.stringify(parsedJson, null, 2);
    setJsonStatus("JSON valide et formaté.", "success");
  });

  minifyButton?.addEventListener("click", () => {
    const parsedJson = parseJsonInput();
    if (!parsedJson) return;

    jsonOutput.value = JSON.stringify(parsedJson);
    setJsonStatus("JSON valide et minifié.", "success");
  });

  validateButton?.addEventListener("click", () => {
    const parsedJson = parseJsonInput();
    if (!parsedJson) return;

    const type = Array.isArray(parsedJson) ? "Array" : typeof parsedJson;
    setJsonStatus(`JSON valide. Type racine : ${type}.`, "success");
  });

  clearButton?.addEventListener("click", () => {
    jsonInput.value = "";
    jsonOutput.value = "";
    setJsonStatus("En attente de JSON.", "default");
  });

  copyButton?.addEventListener("click", async () => {
    const textToCopy = jsonOutput.value || jsonInput.value;

    if (!textToCopy.trim()) {
      setJsonStatus("Aucun JSON à copier.", "warning");
      return;
    }

    await copyToClipboard(textToCopy);
    setJsonStatus("JSON copié dans le presse-papiers.", "success");
  });
}

setupJsonFormatter();
