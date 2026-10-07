import { copyToClipboard, setStatus } from "../utils.js";

const input = document.querySelector("[data-code-input]");
const output = document.querySelector("[data-code-output]");
let result = "";
const status = document.querySelector("[data-code-status]");
const language = document.querySelector("[data-code-language]");
const indent = document.querySelector("[data-code-indent]");

function setCodeStatus(message, type = "default") {
  setStatus(status, message, type);
}

async function formatCode(code) {
  const response = await fetch("/api/code-formatter/format", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      language: language.value,
      indent: indent.value,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Échec du formatage.");
  return result.formatted;
}

function checkBalanced(code) {
  const pairs = { "{": "}", "[": "]", "(": ")" };
  const stack = [];
  let quote = "";
  let escaped = false;
  let line = 1;

  for (const character of code) {
    if (character === "\n") line += 1;
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (["'", '"', "`"].includes(character)) {
      quote = character;
      continue;
    }
    if (pairs[character]) stack.push({ character, line });
    if (Object.values(pairs).includes(character)) {
      const opening = stack.pop();
      if (!opening || pairs[opening.character] !== character)
        return `Délimiteur inattendu à la ligne ${line}.`;
    }
  }
  if (quote) return `Chaîne non terminée à la ligne ${line}.`;
  if (stack.length)
    return `Délimiteur « ${stack[stack.length - 1].character} » non fermé à la ligne ${stack[stack.length - 1].line}.`;
  return null;
}

function validateHtml(code) {
  const stack = [];
  const voidTags =
    /^(br|hr|img|input|meta|link|area|base|embed|param|source|track|wbr)$/i;
  for (const tag of code.match(/<\/?([a-z][\w:-]*)\b[^>]*>/gi) || []) {
    const match = tag.match(/^<\/?([a-z][\w:-]*)/i);
    if (
      !match ||
      /^<!--/.test(tag) ||
      voidTags.test(match[1]) ||
      (/\/?>$/.test(tag) && tag.endsWith("/>"))
    )
      continue;
    if (tag.startsWith("</")) {
      if (stack.pop() !== match[1].toLowerCase())
        return `Balise fermante inattendue : ${match[1]}.`;
    } else stack.push(match[1].toLowerCase());
  }
  return stack.length
    ? `Balise non fermée : ${stack[stack.length - 1]}.`
    : null;
}

function validateCode(code) {
  if (!code.trim()) return "Colle du code avant de lancer une action.";
  if (language.value === "json") {
    try {
      JSON.parse(code);
      return null;
    } catch (error) {
      return `JSON invalide : ${error.message}`;
    }
  }
  if (language.value === "html")
    return validateHtml(code) || checkBalanced(code);
  if (language.value === "javascript") {
    try {
      new Function(code);
      return null;
    } catch (error) {
      return `JavaScript invalide : ${error.message}`;
    }
  }
  if (language.value === "sql") {
    if (!/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(code))
      return "Aucune instruction SQL reconnue.";
    return null;
  }
  const balancedError = checkBalanced(code);
  if (balancedError) return balancedError;
  if (
    language.value === "php" &&
    !code.includes("<?php") &&
    !code.includes("<?=")
  )
    return "Le code PHP doit normalement commencer par <?php ou <?=.";
  if (
    language.value === "java" &&
    !/\b(class|interface|enum|record)\s+\w+/.test(code)
  )
    return "Aucune classe, interface, enum ou record Java détecté.";
  return null;
}

async function formatAction() {
  const error = validateCode(input.value);
  if (error) {
    setCodeStatus(error, "error");
    return;
  }
  try {
    setOutput(await formatCode(input.value));
    setCodeStatus(
      `${language.value.toUpperCase()} valide et formaté.`,
      "success",
    );
  } catch (formatError) {
    setCodeStatus(`Erreur de formatage : ${formatError.message}`, "error");
  }
}

function setOutput(text) {
  result = text;
  output.className = `language-${language.value}`;
  output.textContent = text;
  document.dispatchEvent(new CustomEvent("sorastool:content-updated"));
}

function setupCodeFormatter() {
  if (!input || !output) return;
  document
    .querySelector("[data-code-format]")
    ?.addEventListener("click", formatAction);
  document
    .querySelector("[data-code-validate]")
    ?.addEventListener("click", () => {
      const error = validateCode(input.value);
      setCodeStatus(
        error || `${language.value.toUpperCase()} valide.`,
        error ? "error" : "success",
      );
    });
  document.querySelector("[data-code-clear]")?.addEventListener("click", () => {
    input.value = "";
    setOutput("");
    setCodeStatus("En attente de code.");
  });
  document
    .querySelector("[data-code-copy]")
    ?.addEventListener("click", async () => {
      const value = result || input.value;
      if (!value.trim()) {
        setCodeStatus("Aucun code à copier.", "warning");
        return;
      }
      await copyToClipboard(value);
      setCodeStatus("Code copié dans le presse-papiers.", "success");
    });
}

setupCodeFormatter();
