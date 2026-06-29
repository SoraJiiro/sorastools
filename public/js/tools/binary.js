import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const binaryInput = document.querySelector("[data-binary-input]");
const binaryOutput = document.querySelector("[data-binary-output]");
const binaryStatus = document.querySelector("[data-binary-status]");
const encodeButton = document.querySelector("[data-binary-encode]");
const decodeButton = document.querySelector("[data-binary-decode]");
const swapButton = document.querySelector("[data-binary-swap]");
const copyButton = document.querySelector("[data-binary-copy]");
const clearButton = document.querySelector("[data-binary-clear]");

function setBinaryStatus(message, type = "default") {
  setStatus(binaryStatus, message, type);
}

function textToBinary(value) {
  const bytes = new TextEncoder().encode(value);

  return Array.from(bytes)
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join(" ");
}

function normalizeBinary(value) {
  return value.trim().replace(/\s+/g, "");
}

function binaryToText(value) {
  const cleanValue = normalizeBinary(value);

  if (!/^[01]+$/.test(cleanValue) || cleanValue.length % 8 !== 0) {
    throw new Error("Invalid binary input");
  }

  const bytes = cleanValue.match(/.{8}/g).map((byte) => parseInt(byte, 2));

  return new TextDecoder().decode(new Uint8Array(bytes));
}

function encodeInput() {
  const value = binaryInput.value;

  if (!value.trim()) {
    binaryOutput.value = "";
    setBinaryStatus("Aucun texte à convertir en binaire.", "warning");
    return;
  }

  binaryOutput.value = textToBinary(value);
  setBinaryStatus("Texte converti en binaire.", "success");
}

function decodeInput() {
  const value = binaryInput.value;

  if (!value.trim()) {
    binaryOutput.value = "";
    setBinaryStatus("Aucun binaire à traduire.", "warning");
    return;
  }

  try {
    binaryOutput.value = binaryToText(value);
    setBinaryStatus("Binaire traduit en texte.", "success");
  } catch (error) {
    binaryOutput.value = "";
    setBinaryStatus("Binaire invalide : utilise uniquement des 0 et 1 par groupes de 8 bits.", "error");
  }
}

function swapValues() {
  const inputValue = binaryInput.value;

  binaryInput.value = binaryOutput.value;
  binaryOutput.value = inputValue;
  setBinaryStatus("Input et résultat inversés.", "success");
}

function clearValues() {
  binaryInput.value = "";
  binaryOutput.value = "";
  setBinaryStatus("En attente.", "default");
}

function setupBinaryTool() {
  if (!binaryInput || !binaryOutput) return;

  encodeInput();

  encodeButton?.addEventListener("click", encodeInput);
  decodeButton?.addEventListener("click", decodeInput);
  swapButton?.addEventListener("click", swapValues);
  clearButton?.addEventListener("click", clearValues);

  copyButton?.addEventListener("click", async () => {
    if (!binaryOutput.value.trim()) {
      setBinaryStatus("Aucun résultat à copier.", "warning");
      return;
    }

    await copyToClipboard(binaryOutput.value);
    temporarilyChangeText(copyButton, "Copié");
    setBinaryStatus("Résultat copié dans le presse-papiers.", "success");
  });
}

setupBinaryTool();
