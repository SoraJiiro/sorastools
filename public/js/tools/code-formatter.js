import { copyToClipboard, setStatus } from "../utils.js";

const input = document.querySelector("[data-code-input]");
const output = document.querySelector("[data-code-output]");
const status = document.querySelector("[data-code-status]");
const language = document.querySelector("[data-code-language]");
const indent = document.querySelector("[data-code-indent]");

function setCodeStatus(message, type = "default") {
  setStatus(status, message, type);
}

function getIndent() {
  return indent.value === "tab" ? "\t" : " ".repeat(Number(indent.value));
}

function tokenize(code) {
  return (
    code.match(
      /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\{|\}|;|[^{};]+/g,
    ) || []
  );
}

function formatBlockCode(code) {
  const unit = getIndent();
  let depth = 0;
  const lines = [];

  tokenize(code).forEach((token) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    if (trimmed === "}") depth = Math.max(0, depth - 1);
    const prefix = unit.repeat(depth);
    const previous = lines[lines.length - 1];
    const value = trimmed === "{" ? "{" : trimmed;

    if (trimmed === "{") {
      if (previous && !previous.endsWith(" ")) lines[lines.length - 1] += " {";
      else lines.push(`${prefix}{`);
      depth += 1;
      return;
    }

    if (trimmed === ";") {
      if (lines.length) lines[lines.length - 1] += ";";
      return;
    }

    if (trimmed === "}") {
      lines.push(`${prefix}}`);
      return;
    }

    const chunks = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    chunks.forEach((line) => lines.push(`${prefix}${line}`));
  });

  return lines.join("\n").replace(/\n([ \t]*)(else|catch|finally)\b/g, " $2");
}

function formatCss(code) {
  if (typeof globalThis.css_beautify === "function") {
    return globalThis.css_beautify(code, {
      indent_size: Number(indent.value) || 4,
      indent_char: indent.value === "tab" ? "\t" : " ",
      end_with_newline: false,
    });
  }

  return formatBlockCode(code).replace(/^(\s*)([-\w]+)\s*:\s*/gm, "$1$2: ");
}

function formatHtml(code) {
  if (typeof globalThis.html_beautify === "function") {
    return globalThis.html_beautify(code, {
      indent_size: Number(indent.value) || 4,
      indent_char: indent.value === "tab" ? "\t" : " ",
      wrap_line_length: 0,
      end_with_newline: false,
    });
  }

  const unit = getIndent();
  const normalized = code.replace(/>\s*</g, "><").trim();
  const tokens = normalized.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  const lines = [];
  let depth = 0;

  tokens.forEach((token) => {
    const value = token.trim();
    if (!value) return;
    const closing = /^<\//.test(value);
    const opening = /^<([a-z][\w:-]*)\b[^>]*[^/]?>$/i.test(value);
    if (closing) depth = Math.max(0, depth - 1);
    lines.push(`${unit.repeat(depth)}${value}`);
    if (
      opening &&
      !/^<(br|hr|img|input|meta|link|area|base|embed|param|source|track|wbr)\b/i.test(
        value,
      )
    )
      depth += 1;
  });

  return lines.join("\n");
}

function formatSql(code) {
  if (globalThis.sqlFormatter?.format) {
    return globalThis.sqlFormatter.format(code, {
      language: "sql",
      tabWidth: Number(indent.value) || 4,
      useTabs: indent.value === "tab",
    });
  }

  const keywords =
    /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|UNION|VALUES|SET|RETURNING)\b/gi;
  return code
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*;\s*/g, ";\n")
    .replace(keywords, (match) => `\n${match.toUpperCase()}`)
    .trim()
    .replace(/^\n/, "");
}

function formatJson(code) {
  return JSON.stringify(JSON.parse(code), null, getIndent());
}

function formatCode(code) {
  switch (language.value) {
    case "json":
      return formatJson(code);
    case "html":
      return formatHtml(code);
    case "sql":
      return formatSql(code);
    case "css":
      return formatCss(code);
    default:
      return formatBlockCode(code);
  }
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
  if (
    language.value === "sql" &&
    !/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(code)
  )
    return "Aucune instruction SQL reconnue.";
  return null;
}

function formatAction() {
  const error = validateCode(input.value);
  if (error) {
    setCodeStatus(error, "error");
    return;
  }
  output.value = formatCode(input.value);
  setCodeStatus(
    `${language.value.toUpperCase()} valide et formaté.`,
    "success",
  );
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
    output.value = "";
    setCodeStatus("En attente de code.");
  });
  document
    .querySelector("[data-code-copy]")
    ?.addEventListener("click", async () => {
      const value = output.value || input.value;
      if (!value.trim()) {
        setCodeStatus("Aucun code à copier.", "warning");
        return;
      }
      await copyToClipboard(value);
      setCodeStatus("Code copié dans le presse-papiers.", "success");
    });
}

setupCodeFormatter();
