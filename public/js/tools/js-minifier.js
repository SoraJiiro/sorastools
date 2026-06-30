import {
  copyToClipboard,
  downloadTextFile,
  setStatus,
  temporarilyChangeText,
} from "../utils.js";

const jmInput = document.querySelector("[data-jm-input]");
const jmOutput = document.querySelector("[data-jm-output]");
const jmStatus = document.querySelector("[data-jm-status]");
const jmBefore = document.querySelector("[data-jm-before]");
const jmAfter = document.querySelector("[data-jm-after]");
const jmRatio = document.querySelector("[data-jm-ratio]");
const minifyButton = document.querySelector("[data-jm-minify]");
const copyButton = document.querySelector("[data-jm-copy]");
const downloadButton = document.querySelector("[data-jm-download]");
const swapButton = document.querySelector("[data-jm-swap]");
const clearButton = document.querySelector("[data-jm-clear]");
const obfuscateCheckbox = document.querySelector("[data-jm-obfuscate]");

const BEFORE_REGEX_TOKENS = new Set([
  "(",
  "{",
  "[",
  "=",
  ":",
  ",",
  ";",
  "!",
  "?",
  "&",
  "|",
  "+",
  "-",
  "*",
  "%",
  "^",
  "~",
  "return",
  "throw",
  "case",
  "delete",
  "typeof",
  "void",
  "new",
  "in",
  "of",
  "yield",
  "await",
]);

function setJmStatus(message, type = "default") {
  setStatus(jmStatus, message, type);
}

function isIdentifierChar(char = "") {
  return /[A-Za-z0-9_$]/.test(char);
}

function isWhitespace(char = "") {
  return /\s/.test(char);
}

function getPreviousToken(output) {
  const match = output.match(/([A-Za-z_$][\w$]*|\+\+|--|=>|\S)\s*$/);
  return match ? match[1] : "";
}

function shouldKeepSpace(previousChar, nextChar) {
  if (!previousChar || !nextChar) return false;
  if (isIdentifierChar(previousChar) && isIdentifierChar(nextChar)) return true;
  if ((previousChar === "+" && nextChar === "+") || (previousChar === "-" && nextChar === "-")) return true;
  if (previousChar === "/" && nextChar === "/") return true;
  return false;
}

function findNextNonWhitespace(source, startIndex) {
  for (let index = startIndex; index < source.length; index += 1) {
    if (!isWhitespace(source[index])) return source[index];
  }

  return "";
}

function readString(source, startIndex, quote) {
  let index = startIndex;
  let result = quote;
  index += 1;

  while (index < source.length) {
    const char = source[index];
    result += char;

    if (char === "\\") {
      index += 1;
      if (index < source.length) result += source[index];
    } else if (char === quote) {
      break;
    }

    index += 1;
  }

  return { value: result, index };
}

function readTemplate(source, startIndex) {
  let index = startIndex;
  let result = "`";
  index += 1;

  while (index < source.length) {
    const char = source[index];
    result += char;

    if (char === "\\") {
      index += 1;
      if (index < source.length) result += source[index];
    } else if (char === "`") {
      break;
    }

    index += 1;
  }

  return { value: result, index };
}

function readRegex(source, startIndex) {
  let index = startIndex;
  let result = "/";
  let inClass = false;
  index += 1;

  while (index < source.length) {
    const char = source[index];
    result += char;

    if (char === "\\") {
      index += 1;
      if (index < source.length) result += source[index];
    } else if (char === "[") {
      inClass = true;
    } else if (char === "]") {
      inClass = false;
    } else if (char === "/" && !inClass) {
      index += 1;
      while (/[a-z]/i.test(source[index] || "")) {
        result += source[index];
        index += 1;
      }
      index -= 1;
      break;
    }

    index += 1;
  }

  return { value: result, index };
}

function canStartRegex(output) {
  const previousToken = getPreviousToken(output);
  return !previousToken || BEFORE_REGEX_TOKENS.has(previousToken);
}

function minifyJavaScript(source) {
  let output = "";
  let pendingSpace = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (isWhitespace(char)) {
      pendingSpace = true;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      pendingSpace = true;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      pendingSpace = true;
      continue;
    }

    const previousChar = output.at(-1) || "";
    const nextMeaningfulChar = char || findNextNonWhitespace(source, index);

    if (pendingSpace && shouldKeepSpace(previousChar, nextMeaningfulChar)) {
      output += " ";
    }

    pendingSpace = false;

    if (char === '"' || char === "'") {
      const token = readString(source, index, char);
      output += token.value;
      index = token.index;
      continue;
    }

    if (char === "`") {
      const token = readTemplate(source, index);
      output += token.value;
      index = token.index;
      continue;
    }

    if (char === "/" && canStartRegex(output)) {
      const token = readRegex(source, index);
      output += token.value;
      index = token.index;
      continue;
    }

    output += char;
  }

  return output.trim();
}

function hasModuleSyntax(code) {
  return /(^|[;\n])\s*(import|export)\s/m.test(code);
}

function toBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function obfuscateJavaScript(code) {
  const encoded = toBase64Utf8(code);
  return `(()=>{const d="${encoded}";const b=Uint8Array.from(atob(d),c=>c.charCodeAt(0));new Function(new TextDecoder().decode(b))();})();`;
}

function validateJavaScript(code) {
  if (!code.trim()) return;
  if (hasModuleSyntax(code)) return;
  new Function(code);
}

function updateStats(inputLength, outputLength) {
  if (jmBefore) jmBefore.textContent = String(inputLength);
  if (jmAfter) jmAfter.textContent = String(outputLength);

  if (!jmRatio) return;

  if (!inputLength) {
    jmRatio.textContent = "";
    return;
  }

  const reduction = Math.max(0, Math.round((1 - outputLength / inputLength) * 100));
  jmRatio.textContent = `(${reduction}% réduit)`;
}

function minifyInput() {
  const value = jmInput.value;

  if (!value.trim()) {
    jmOutput.value = "";
    updateStats(0, 0);
    setJmStatus("Aucun JavaScript à minifier.", "warning");
    return;
  }

  try {
    const minified = minifyJavaScript(value);
    validateJavaScript(minified);

    const shouldObfuscate = Boolean(obfuscateCheckbox?.checked);
    const output = shouldObfuscate ? obfuscateJavaScript(minified) : minified;

    jmOutput.value = output;
    updateStats(value.length, output.length);
    setJmStatus(
      shouldObfuscate
        ? "JavaScript minifié et obfusqué avec succès."
        : "JavaScript minifié avec succès.",
      "success",
    );
  } catch (error) {
    jmOutput.value = "";
    updateStats(value.length, 0);
    setJmStatus("JavaScript invalide ou impossible à minifier proprement.", "error");
  }
}

function clearValues() {
  jmInput.value = "";
  jmOutput.value = "";
  updateStats(0, 0);
  setJmStatus("En attente.", "default");
}

function swapValues() {
  if (!jmOutput.value.trim()) {
    setJmStatus("Aucun résultat à remplacer.", "warning");
    return;
  }

  jmInput.value = jmOutput.value;
  jmOutput.value = "";
  updateStats(jmInput.value.length, 0);
  setJmStatus("Le résultat a remplacé l'input.", "success");
}

function setupJsMinifier() {
  if (!jmInput || !jmOutput) return;

  minifyInput();

  minifyButton?.addEventListener("click", minifyInput);
  obfuscateCheckbox?.addEventListener("change", minifyInput);
  clearButton?.addEventListener("click", clearValues);
  swapButton?.addEventListener("click", swapValues);

  copyButton?.addEventListener("click", async () => {
    if (!jmOutput.value.trim()) {
      setJmStatus("Aucun résultat à copier.", "warning");
      return;
    }

    await copyToClipboard(jmOutput.value);
    temporarilyChangeText(copyButton, "Copié");
    setJmStatus("Résultat copié dans le presse-papiers.", "success");
  });

  downloadButton?.addEventListener("click", () => {
    if (!jmOutput.value.trim()) {
      setJmStatus("Aucun résultat à télécharger.", "warning");
      return;
    }

    downloadTextFile(jmOutput.value, "script.min.js", "text/javascript");
    temporarilyChangeText(downloadButton, "Téléchargé");
    setJmStatus("Fichier JavaScript téléchargé.", "success");
  });
}

setupJsMinifier();