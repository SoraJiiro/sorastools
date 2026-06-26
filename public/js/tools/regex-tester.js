import { copyToClipboard, escapeHtml, setStatus, temporarilyChangeText } from "../utils.js";

const regexPreset = document.querySelector("[data-regex-preset]");
const regexPattern = document.querySelector("[data-regex-pattern]");
const regexCopyButton = document.querySelector("[data-regex-copy]");
const regexText = document.querySelector("[data-regex-text]");
const regexPreview = document.querySelector("[data-regex-preview]");
const regexStatus = document.querySelector("[data-regex-status]");
const regexMatches = document.querySelector("[data-regex-matches]");

const regexPresets = {
  email: {
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    text: "Contact : support@soratools.dev ou admin@example.com",
    flags: ["g", "i"],
  },
  url: {
    pattern: "https?:\\/\\/(?:www\\.)?[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(?:\\/[^\\s]*)?",
    text: "Sites : https://soratools.dev et http://example.com/docs?page=1",
    flags: ["g", "i"],
  },
  date: {
    pattern: "\\b(?:\\d{2}\\/\\d{2}\\/\\d{4}|\\d{4}-\\d{2}-\\d{2})\\b",
    text: "Dates : 26/06/2026, 2026-06-26 et 01/01/2027",
    flags: ["g"],
  },
  ip: {
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b",
    text: "IPs : 192.168.1.1, 8.8.8.8, 255.255.255.255",
    flags: ["g"],
  },
  phone: {
    pattern: "(?:\\+33|0)[1-9](?:[ .-]?\\d{2}){4}",
    text: "Téléphones : 06 12 34 56 78, 03-26-12-34-56, +33612345678",
    flags: ["g"],
  },
  string: {
    pattern: "(['\"])(?:(?!\\1).)*\\1",
    text: "Strings : const name = \"SoraTools\"; const type = 'regex';",
    flags: ["g"],
  },
  int: {
    pattern: "\\b-?\\d+\\b",
    text: "Nombres : 42, -12, 2026, 0 et 9999",
    flags: ["g"],
  },
  "credit-card": {
    pattern: "\\b(?:\\d[ -]*?){13,19}\\b",
    text: "Cartes de test : 4111 1111 1111 1111 et 5555-5555-5555-4444",
    flags: ["g"],
  },
};

function getRegexFlags() {
  return Array.from(document.querySelectorAll("[data-regex-flag]:checked"))
    .map((checkbox) => checkbox.value)
    .join("");
}

function setRegexFlags(flags) {
  document.querySelectorAll("[data-regex-flag]").forEach((checkbox) => {
    checkbox.checked = flags.includes(checkbox.value);
  });
}

function setRegexStatus(message, type = "default") {
  setStatus(regexStatus, message, type);
}

function updateRegexTester() {
  if (!regexPattern || !regexText || !regexPreview || !regexMatches) return;

  const pattern = regexPattern.value;
  const text = regexText.value;
  const flags = getRegexFlags();

  regexMatches.innerHTML = "";

  if (!pattern.trim()) {
    regexPreview.textContent = text;
    setRegexStatus("Entre une expression régulière.", "warning");
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    const matches = Array.from(text.matchAll(flags.includes("g") ? regex : new RegExp(pattern, `${flags}g`)));

    if (matches.length === 0) {
      regexPreview.textContent = text;
      setRegexStatus("Aucune correspondance trouvée.", "warning");
      return;
    }

    let cursor = 0;
    let highlighted = "";

    matches.forEach((match, index) => {
      const value = match[0];
      const start = match.index ?? 0;
      const end = start + value.length;

      highlighted += escapeHtml(text.slice(cursor, start));
      highlighted += `<mark>${escapeHtml(value || "")}</mark>`;
      cursor = end;

      const item = document.createElement("li");
      item.textContent = `#${index + 1} | index ${start} | ${value || "match vide"}`;
      regexMatches.appendChild(item);
    });

    highlighted += escapeHtml(text.slice(cursor));
    regexPreview.innerHTML = highlighted;
    setRegexStatus(`${matches.length} correspondance${matches.length > 1 ? "s" : ""} trouvée${matches.length > 1 ? "s" : ""}.`, "success");
  } catch (error) {
    regexPreview.textContent = text;
    setRegexStatus(`Regex invalide : ${error.message}`, "error");
  }
}

function setupRegexTester() {
  if (!regexPattern || !regexText) return;

  updateRegexTester();

  regexCopyButton?.addEventListener("click", async () => {
    if (!regexPattern.value.trim()) {
      setRegexStatus("Aucune regex à copier.", "warning");
      return;
    }

    await copyToClipboard(regexPattern.value);
    temporarilyChangeText(regexCopyButton, "Copié");
    setRegexStatus("Regex copiée dans le presse-papiers.", "success");
  });

  regexPreset?.addEventListener("change", () => {
    const preset = regexPresets[regexPreset.value];

    if (!preset) return;

    regexPattern.value = preset.pattern;
    regexText.value = preset.text;
    setRegexFlags(preset.flags);
    updateRegexTester();
  });

  regexPattern.addEventListener("input", () => {
    if (regexPreset) regexPreset.value = "";
    updateRegexTester();
  });

  regexText.addEventListener("input", updateRegexTester);
  document.querySelectorAll("[data-regex-flag]").forEach((checkbox) => {
    checkbox.addEventListener("change", updateRegexTester);
  });
}

setupRegexTester();
