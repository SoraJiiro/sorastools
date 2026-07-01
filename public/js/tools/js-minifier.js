import {
  copyToClipboard,
  downloadTextFile,
  setStatus,
  temporarilyChangeText,
} from "../utils.js";

import * as acorn from "https://cdn.jsdelivr.net/npm/acorn@8.17.0/dist/acorn.mjs";

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
const moduleCheckbox = document.querySelector("[data-jm-module]");
const obfuscationLevelSelect = document.querySelector("[data-jm-obf-level]");

let activeMinifyRunId = 0;

function setJmStatus(message, type = "default") {
  setStatus(jmStatus, message, type);
}

function parseJavaScript(code, moduleMode = false) {
  return acorn.parse(code, {
    ecmaVersion: "latest",
    sourceType: moduleMode ? "module" : "script",
    allowHashBang: true,
  });
}

function detectModuleMode(code) {
  if (moduleCheckbox?.checked) return true;

  try {
    parseJavaScript(code, false);
    return false;
  } catch (scriptError) {
    parseJavaScript(code, true);
    return true;
  }
}

async function minifyJavaScript(code, moduleMode = false) {
  const minify = globalThis.Terser?.minify;

  if (typeof minify !== "function") {
    const error = new Error("MINIFIER_UNAVAILABLE");
    error.code = "MINIFIER_UNAVAILABLE";
    throw error;
  }

  const result = await minify(code, {
    ecma: 2020,
    module: moduleMode,
    compress: {
      passes: 2,
      module: moduleMode,
      toplevel: !moduleMode,
    },
    mangle: {
      toplevel: !moduleMode,
    },
    format: {
      comments: false,
    },
  });

  if (!result.code?.trim()) {
    throw new Error("MINIFY_EMPTY_RESULT");
  }

  return result.code.trim();
}

function getSelectedObfuscationLevel() {
  return obfuscationLevelSelect?.value === "strong" ? "strong" : "balanced";
}

function getObfuscationLevelLabel(level) {
  return level === "strong" ? "fort" : "équilibré";
}

function buildObfuscationOptions(level, moduleMode = false) {
  const options = {
    compact: true,
    simplify: true,
    identifierNamesGenerator: "hexadecimal",
    numbersToExpressions: true,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 1,
    rotateStringArray: true,
    shuffleStringArray: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    transformObjectKeys: true,
    renameGlobals: !moduleMode,
    ignoreImports: moduleMode,
    unicodeEscapeSequence: false,
  };

  if (level === "strong" && !moduleMode) {
    return {
      ...options,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.6,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.08,
      selfDefending: true,
      disableConsoleOutput: true,
    };
  }

  return {
    ...options,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    disableConsoleOutput: false,
  };
}

function obfuscateJavaScript(code, moduleMode = false) {
  const obfuscator = globalThis.JavaScriptObfuscator;

  if (!obfuscator?.obfuscate) {
    const error = new Error("OBFUSCATOR_UNAVAILABLE");
    error.code = "OBFUSCATOR_UNAVAILABLE";
    throw error;
  }

  const level = getSelectedObfuscationLevel();
  const strongOptions = buildObfuscationOptions(level, moduleMode);

  try {
    return obfuscator.obfuscate(code, strongOptions).getObfuscatedCode();
  } catch (firstError) {
    const fallbackOptions = {
      compact: true,
      simplify: true,
      identifierNamesGenerator: "hexadecimal",
      stringArray: true,
      stringArrayEncoding: ["base64"],
      stringArrayThreshold: 1,
      renameGlobals: !moduleMode,
      ignoreImports: moduleMode,
    };

    return obfuscator.obfuscate(code, fallbackOptions).getObfuscatedCode();
  }
}

function validateJavaScript(code, moduleMode = false) {
  if (!code.trim()) return;
  parseJavaScript(code, moduleMode);
}

function updateStats(inputLength, outputLength) {
  if (jmBefore) jmBefore.textContent = String(inputLength);
  if (jmAfter) jmAfter.textContent = String(outputLength);

  if (!jmRatio) return;

  if (!inputLength) {
    jmRatio.textContent = "";
    return;
  }

  const deltaPercent = Math.round(
    ((outputLength - inputLength) / inputLength) * 100,
  );

  if (deltaPercent > 0) {
    jmRatio.textContent = `(+${deltaPercent}% plus lourd)`;
    return;
  }

  if (deltaPercent < 0) {
    jmRatio.textContent = `(${Math.abs(deltaPercent)}% réduit)`;
    return;
  }

  jmRatio.textContent = "(taille inchangée)";
}

function syncObfuscationControls() {
  if (!obfuscationLevelSelect) return;
  obfuscationLevelSelect.disabled = !obfuscateCheckbox?.checked;
}

async function minifyInput() {
  const currentRunId = ++activeMinifyRunId;
  const value = jmInput.value;

  if (!value.trim()) {
    jmOutput.value = "";
    updateStats(0, 0);
    setJmStatus("Aucun JavaScript à minifier.", "warning");
    return;
  }

  try {
    setJmStatus("Traitement en cours...", "default");

    const moduleMode = detectModuleMode(value);
    const minified = await minifyJavaScript(value, moduleMode);
    validateJavaScript(minified, moduleMode);

    if (currentRunId !== activeMinifyRunId) return;

    const shouldObfuscate = Boolean(obfuscateCheckbox?.checked);
    const obfuscationLevel = getSelectedObfuscationLevel();
    let output = minified;
    let obfuscationSkipped = false;

    if (shouldObfuscate) {
      try {
        output = obfuscateJavaScript(minified, moduleMode);
      } catch (obfuscationError) {
        if (obfuscationError?.code === "OBFUSCATOR_UNAVAILABLE") {
          obfuscationSkipped = true;
        } else {
          throw obfuscationError;
        }
      }
    }

    validateJavaScript(output, moduleMode);

    if (currentRunId !== activeMinifyRunId) return;

    jmOutput.value = output;
    updateStats(value.length, output.length);
    if (obfuscationSkipped) {
      setJmStatus(
        "Obfuscateur indisponible: code minifié uniquement.",
        "warning",
      );
      return;
    }

    setJmStatus(
      shouldObfuscate
        ? `JavaScript minifié puis obfusqué (${getObfuscationLevelLabel(obfuscationLevel)}${moduleMode ? ", mode module" : ""}).`
        : `JavaScript minifié avec succès${moduleMode ? " en mode module" : ""}.`,
      "success",
    );
  } catch (error) {
    if (currentRunId !== activeMinifyRunId) return;

    jmOutput.value = "";
    updateStats(value.length, 0);

    if (error?.code === "MINIFIER_UNAVAILABLE") {
      setJmStatus(
        "Le moteur de minification est indisponible pour le moment.",
        "error",
      );
      return;
    }

    setJmStatus(
      "JavaScript invalide ou impossible à minifier proprement.",
      "error",
    );
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

  syncObfuscationControls();
  void minifyInput();

  minifyButton?.addEventListener("click", () => {
    void minifyInput();
  });
  obfuscateCheckbox?.addEventListener("change", () => {
    syncObfuscationControls();
    void minifyInput();
  });
  moduleCheckbox?.addEventListener("change", () => {
    void minifyInput();
  });
  obfuscationLevelSelect?.addEventListener("change", () => {
    if (!obfuscateCheckbox?.checked) return;
    void minifyInput();
  });
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
