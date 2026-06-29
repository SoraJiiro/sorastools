import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const hexInput = document.querySelector("[data-hex-input]");
const hexOutput = document.querySelector("[data-hex-output]");
const hexStatus = document.querySelector("[data-hex-status]");
const encodeButton = document.querySelector("[data-hex-encode]");
const decodeButton = document.querySelector("[data-hex-decode]");
const swapButton = document.querySelector("[data-hex-swap]");
const copyButton = document.querySelector("[data-hex-copy]");
const clearButton = document.querySelector("[data-hex-clear]");

function setHexStatus(message, type = "default") {
  setStatus(hexStatus, message, type);
}

function textToHex(value) {
  const bytes = new TextEncoder().encode(value);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

function normalizeHex(value) {
  return value.trim().replace(/0x/gi, "").replace(/[\s:,-]+/g, "");
}

function hexToText(value) {
  const cleanValue = normalizeHex(value);

  if (!/^[0-9a-fA-F]+$/.test(cleanValue) || cleanValue.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal input");
  }

  const bytes = cleanValue.match(/.{2}/g).map((byte) => parseInt(byte, 16));

  return new TextDecoder().decode(new Uint8Array(bytes));
}

function encodeInput() {
  const value = hexInput.value;

  if (!value.trim()) {
    hexOutput.value = "";
    setHexStatus("Aucun texte à convertir en hexadécimal.", "warning");
    return;
  }

  hexOutput.value = textToHex(value);
  setHexStatus("Texte converti en hexadécimal.", "success");
}

function decodeInput() {
  const value = hexInput.value;

  if (!value.trim()) {
    hexOutput.value = "";
    setHexStatus("Aucun hexadécimal à traduire.", "warning");
    return;
  }

  try {
    hexOutput.value = hexToText(value);
    setHexStatus("Hexadécimal traduit en texte.", "success");
  } catch (error) {
    hexOutput.value = "";
    setHexStatus("Hexadécimal invalide : utilise des caractères 0-9 et A-F par paires.", "error");
  }
}

function swapValues() {
  const inputValue = hexInput.value;

  hexInput.value = hexOutput.value;
  hexOutput.value = inputValue;
  setHexStatus("Input et résultat inversés.", "success");
}

function clearValues() {
  hexInput.value = "";
  hexOutput.value = "";
  setHexStatus("En attente.", "default");
}

function setupHexTool() {
  if (!hexInput || !hexOutput) return;

  encodeInput();

  encodeButton?.addEventListener("click", encodeInput);
  decodeButton?.addEventListener("click", decodeInput);
  swapButton?.addEventListener("click", swapValues);
  clearButton?.addEventListener("click", clearValues);

  copyButton?.addEventListener("click", async () => {
    if (!hexOutput.value.trim()) {
      setHexStatus("Aucun résultat à copier.", "warning");
      return;
    }

    await copyToClipboard(hexOutput.value);
    temporarilyChangeText(copyButton, "Copié");
    setHexStatus("Résultat copié dans le presse-papiers.", "success");
  });
}

setupHexTool();
