import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const b64Input = document.querySelector("[data-b64-input]");
const b64Output = document.querySelector("[data-b64-output]");
const b64Status = document.querySelector("[data-b64-status]");
const encodeButton = document.querySelector("[data-b64-encode]");
const decodeButton = document.querySelector("[data-b64-decode]");
const swapButton = document.querySelector("[data-b64-swap]");
const copyButton = document.querySelector("[data-b64-copy]");
const clearButton = document.querySelector("[data-b64-clear]");

function setB64Status(message, type = "default") {
  setStatus(b64Status, message, type);
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function decodeBase64(value) {
  const cleanValue = value.trim().replace(/\s+/g, "");
  const binary = atob(cleanValue);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function encodeInput() {
  const value = b64Input.value;

  if (!value.trim()) {
    b64Output.value = "";
    setB64Status("Aucun texte à encoder.", "warning");
    return;
  }

  b64Output.value = encodeBase64(value);
  setB64Status("Texte encodé en Base64.", "success");
}

function decodeInput() {
  const value = b64Input.value;

  if (!value.trim()) {
    b64Output.value = "";
    setB64Status("Aucune chaîne Base64 à décoder.", "warning");
    return;
  }

  try {
    b64Output.value = decodeBase64(value);
    setB64Status("Base64 décodé avec succès.", "success");
  } catch (error) {
    b64Output.value = "";
    setB64Status("Base64 invalide ou impossible à décoder.", "error");
  }
}

function swapValues() {
  const inputValue = b64Input.value;

  b64Input.value = b64Output.value;
  b64Output.value = inputValue;
  setB64Status("Input et résultat inversés.", "success");
}

function clearValues() {
  b64Input.value = "";
  b64Output.value = "";
  setB64Status("En attente.", "default");
}

function setupBase64Tool() {
  if (!b64Input || !b64Output) return;

  encodeInput();

  encodeButton?.addEventListener("click", encodeInput);
  decodeButton?.addEventListener("click", decodeInput);
  swapButton?.addEventListener("click", swapValues);
  clearButton?.addEventListener("click", clearValues);

  copyButton?.addEventListener("click", async () => {
    if (!b64Output.value.trim()) {
      setB64Status("Aucun résultat à copier.", "warning");
      return;
    }

    await copyToClipboard(b64Output.value);
    temporarilyChangeText(copyButton, "Copié");
    setB64Status("Résultat copié dans le presse-papiers.", "success");
  });
}

setupBase64Tool();
