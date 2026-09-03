import { copyToClipboard, setStatus } from "../utils.js";

const textInput = document.querySelector("[data-crypt-text]");
const saltInput = document.querySelector("[data-crypt-salt]");
const output = document.querySelector("[data-crypt-output]");
const fingerprint = document.querySelector("[data-crypt-fingerprint]");
const status = document.querySelector("[data-crypt-status]");

function setCryptStatus(message, type = "default") {
  setStatus(status, message, type);
}

async function hashText() {
  if (!textInput.value) {
    output.value = "";
    fingerprint.value = "";
    setCryptStatus("Saisis un texte à hacher.", "warning");
    return;
  }
  if (!saltInput.value.trim()) {
    output.value = "";
    fingerprint.value = "";
    setCryptStatus("Saisis un SEL crypt().", "warning");
    return;
  }

  try {
    const response = await fetch("/api/crypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textInput.value, salt: saltInput.value }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message);
    output.value = data.hash;
    fingerprint.value = data.hash.slice(-32);
    setCryptStatus("Hash généré avec PHP crypt().", "success");
  } catch (error) {
    output.value = "";
    fingerprint.value = "";
    setCryptStatus(error.message || "Impossible de générer le hash.", "error");
  }
}

function setupCryptHasher() {
  if (!textInput || !saltInput || !output || !fingerprint) return;
  document
    .querySelector("[data-crypt-hash]")
    ?.addEventListener("click", hashText);
  document
    .querySelector("[data-crypt-clear]")
    ?.addEventListener("click", () => {
      textInput.value = "";
      output.value = "";
      fingerprint.value = "";
      setCryptStatus("En attente.");
    });
  document
    .querySelector("[data-crypt-copy]")
    ?.addEventListener("click", async () => {
      if (!output.value) {
        setCryptStatus("Aucun hash à copier.", "warning");
        return;
      }
      await copyToClipboard(output.value);
      setCryptStatus("Hash copié dans le presse-papiers.", "success");
    });
}

setupCryptHasher();
