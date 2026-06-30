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

const RESERVED_WORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "await",
  "true",
  "false",
  "null",
  "undefined",
]);

function setJmStatus(message, type = "default") {
  setStatus(jmStatus, message, type);
}

function isIdentifierChar(char = "") {
  return /[A-Za-z0-9_$]/.test(char);
}

function isIdentifierStart(char = "") {
  return /[A-Za-z_$]/.test(char);
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
  if (isIdentifierChar(previousChar) && nextChar === "/") return true;
  if ((previousChar === "+" && nextChar === "+") || (previousChar === "-" && nextChar === "-")) return true;
  if (previousChar === "/" && nextChar === "/") return true;
  return false;
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

    if (pendingSpace && shouldKeepSpace(previousChar, char)) {
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

function toBase64Bytes(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function encodeEncryptedString(value, key) {
  const bytes = new TextEncoder().encode(value);
  const encryptedBytes = bytes.map((byte, index) => byte ^ ((key + index * 17) & 255));

  return toBase64Bytes(encryptedBytes);
}

function parseStringLiteral(literal) {
  return Function(`"use strict";return(${literal});`)();
}

function getObfuscatedStringCall(index) {
  return `_0xS(${index.toString(16)})`;
}

function replaceStringLiterals(code) {
  const stringTable = [];
  const stringIndexByValue = new Map();
  let output = "";

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];

    if (char === '"' || char === "'") {
      const token = readString(code, index, char);

      try {
        const value = parseStringLiteral(token.value);

        if (!stringIndexByValue.has(value)) {
          stringIndexByValue.set(value, stringTable.length);
          stringTable.push(value);
        }

        output += getObfuscatedStringCall(stringIndexByValue.get(value));
      } catch (error) {
        output += token.value;
      }

      index = token.index;
      continue;
    }

    if (char === "`") {
      const token = readTemplate(code, index);
      output += token.value;
      index = token.index;
      continue;
    }

    if (char === "/" && code[index + 1] !== "/" && code[index + 1] !== "*" && canStartRegex(output)) {
      const token = readRegex(code, index);
      output += token.value;
      index = token.index;
      continue;
    }

    output += char;
  }

  return { code: output, stringTable };
}

function obfuscateNumbers(code) {
  let output = "";

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];

    if (char === '"' || char === "'") {
      const token = readString(code, index, char);
      output += token.value;
      index = token.index;
      continue;
    }

    if (char === "`") {
      const token = readTemplate(code, index);
      output += token.value;
      index = token.index;
      continue;
    }

    if (char === "/" && code[index + 1] !== "/" && code[index + 1] !== "*" && canStartRegex(output)) {
      const token = readRegex(code, index);
      output += token.value;
      index = token.index;
      continue;
    }

    if (/\d/.test(char)) {
      const previousChar = code[index - 1] || "";
      let rawNumber = char;
      let nextIndex = index + 1;

      while (/\d/.test(code[nextIndex] || "")) {
        rawNumber += code[nextIndex];
        nextIndex += 1;
      }

      const nextChar = code[nextIndex] || "";
      const isSafeInteger =
        !isIdentifierChar(previousChar) &&
        previousChar !== "." &&
        nextChar !== "." &&
        !isIdentifierChar(nextChar);

      if (isSafeInteger) {
        output += `0x${Number(rawNumber).toString(16)}`;
        index = nextIndex - 1;
        continue;
      }
    }

    output += char;
  }

  return output;
}

function collectDeclaredIdentifiers(code) {
  const identifiers = new Set();
  const declarationRegex = /\b(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/g;
  let match;

  while ((match = declarationRegex.exec(code))) {
    if (!RESERVED_WORDS.has(match[1]) && !match[1].startsWith("_0x")) {
      identifiers.add(match[1]);
    }
  }

  return [...identifiers];
}

function renameIdentifiers(code) {
  const identifiers = collectDeclaredIdentifiers(code);
  let renamedCode = code;

  identifiers.forEach((identifier, index) => {
    const newName = `_0x${(index + 4919).toString(16)}`;
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedIdentifier}\\b`, "g");
    renamedCode = renamedCode.replace(regex, newName);
  });

  return renamedCode;
}

function buildStringDecoder(stringTable, key) {
  if (!stringTable.length) return "";

  const encodedStrings = stringTable.map((value) => encodeEncryptedString(value, key));

  return `const _0xA=${JSON.stringify(encodedStrings)};const _0xK=${key};const _0xC={};function _0xS(_0xI){if(_0xC[_0xI])return _0xC[_0xI];const _0xB=Uint8Array.from(atob(_0xA[_0xI]),(_0xD,_0xJ)=>_0xD.charCodeAt(0)^((_0xK+_0xJ*0x11)&0xff));return _0xC[_0xI]=new TextDecoder().decode(_0xB);}`;
}

function obfuscateJavaScript(code) {
  const stringKey = Math.floor(Math.random() * 155) + 71;
  const stringsResult = replaceStringLiterals(code);
  const withHexNumbers = obfuscateNumbers(stringsResult.code);
  const withRenamedIdentifiers = renameIdentifiers(withHexNumbers);
  const decoder = buildStringDecoder(stringsResult.stringTable, stringKey);
  const protectedCode = `${decoder}${decoder ? ";" : ""}${withRenamedIdentifiers}`;

  return `(()=>{${protectedCode}})();`;
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

    validateJavaScript(output);

    jmOutput.value = output;
    updateStats(value.length, output.length);
    setJmStatus(
      shouldObfuscate
        ? "JavaScript minifié, strings chiffrées et obfusqué avec succès."
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