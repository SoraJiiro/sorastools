import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const durationValueInput = document.querySelector("[data-time-duration-value]");
const durationFromSelect = document.querySelector("[data-time-duration-from]");
const durationToSelect = document.querySelector("[data-time-duration-to]");
const durationOutput = document.querySelector("[data-time-duration-output]");
const durationStatus = document.querySelector("[data-time-duration-status]");
const durationConvertButton = document.querySelector("[data-time-duration-convert]");
const durationSwapButton = document.querySelector("[data-time-duration-swap]");
const durationCopyButton = document.querySelector("[data-time-duration-copy]");
const durationClearButton = document.querySelector("[data-time-duration-clear]");

const timestampModeSelect = document.querySelector("[data-time-timestamp-mode]");
const timestampInput = document.querySelector("[data-time-timestamp-input]");
const timestampOutput = document.querySelector("[data-time-timestamp-output]");
const timestampStatus = document.querySelector("[data-time-timestamp-status]");
const timestampRunButton = document.querySelector("[data-time-timestamp-run]");
const timestampNowButton = document.querySelector("[data-time-timestamp-now]");
const timestampCopyButton = document.querySelector("[data-time-timestamp-copy]");
const timestampClearButton = document.querySelector("[data-time-timestamp-clear]");

const DURATION_UNITS = {
  ms: { label: "Millisecondes", factor: 1 },
  s: { label: "Secondes", factor: 1000 },
  min: { label: "Minutes", factor: 60 * 1000 },
  h: { label: "Heures", factor: 60 * 60 * 1000 },
  d: { label: "Jours", factor: 24 * 60 * 60 * 1000 },
  month: { label: "Mois", factor: 30.4375 * 24 * 60 * 60 * 1000 },
  year: { label: "Années", factor: 365.25 * 24 * 60 * 60 * 1000 },
};

function setDurationStatus(message, type = "default") {
  setStatus(durationStatus, message, type);
}

function setTimestampStatus(message, type = "default") {
  setStatus(timestampStatus, message, type);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Impossible";
  if (Number.isInteger(value)) return String(value);

  return Number(value.toFixed(10)).toString();
}

function getDateParts(date) {
  return {
    local: date.toLocaleString("fr-FR"),
    utc: date.toUTCString(),
    iso: date.toISOString(),
    unixSeconds: Math.floor(date.getTime() / 1000),
    unixMilliseconds: date.getTime(),
  };
}

function convertDuration() {
  const rawValue = durationValueInput.value.trim().replace(",", ".");
  const value = Number(rawValue);
  const fromUnit = DURATION_UNITS[durationFromSelect.value];
  const toUnit = DURATION_UNITS[durationToSelect.value];

  if (!rawValue) {
    durationOutput.value = "";
    setDurationStatus("Entre une valeur à convertir.", "warning");
    return;
  }

  if (!Number.isFinite(value)) {
    durationOutput.value = "";
    setDurationStatus("Valeur invalide.", "error");
    return;
  }

  const milliseconds = value * fromUnit.factor;
  const convertedValue = milliseconds / toUnit.factor;

  durationOutput.value = [
    `${value} ${fromUnit.label} = ${formatNumber(convertedValue)} ${toUnit.label}`,
    "",
    "Toutes les conversions :",
    ...Object.entries(DURATION_UNITS).map(([unit, data]) => {
      return `${formatNumber(milliseconds / data.factor)} ${data.label} (${unit})`;
    }),
  ].join("\n");

  setDurationStatus("Conversion effectuée.", "success");
}

function swapDurationUnits() {
  const oldFrom = durationFromSelect.value;

  durationFromSelect.value = durationToSelect.value;
  durationToSelect.value = oldFrom;
  convertDuration();
}

function clearDuration() {
  durationValueInput.value = "";
  durationOutput.value = "";
  setDurationStatus("En attente.", "default");
}

function parseTimestampValue(value) {
  const cleanValue = value.trim();

  if (!cleanValue) return null;

  if (/^-?\d+$/.test(cleanValue)) {
    const timestamp = Number(cleanValue);
    const timestampMs = Math.abs(timestamp) < 100000000000 ? timestamp * 1000 : timestamp;

    return new Date(timestampMs);
  }

  return new Date(cleanValue);
}

function renderDateResult(date) {
  const parts = getDateParts(date);

  return [
    `Date locale : ${parts.local}`,
    `Date UTC : ${parts.utc}`,
    `ISO 8601 : ${parts.iso}`,
    `Timestamp Unix (s) : ${parts.unixSeconds}`,
    `Timestamp Unix (ms) : ${parts.unixMilliseconds}`,
  ].join("\n");
}

function runTimestampTool() {
  const mode = timestampModeSelect.value;
  const value = timestampInput.value.trim();

  try {
    if (mode === "now") {
      timestampOutput.value = renderDateResult(new Date());
      setTimestampStatus("Timestamp actuel généré.", "success");
      return;
    }

    if (!value) {
      timestampOutput.value = "";
      setTimestampStatus("Entre une date ou un timestamp.", "warning");
      return;
    }

    const date = parseTimestampValue(value);

    if (!date || Number.isNaN(date.getTime())) {
      timestampOutput.value = "";
      setTimestampStatus("Date ou timestamp invalide.", "error");
      return;
    }

    timestampOutput.value = renderDateResult(date);
    setTimestampStatus("Timestamp décodé / généré.", "success");
  } catch (error) {
    timestampOutput.value = "";
    setTimestampStatus("Impossible de traiter cette valeur.", "error");
  }
}

function fillCurrentDate() {
  const now = new Date();

  timestampModeSelect.value = "date";
  timestampInput.value = now.toISOString().slice(0, 19);
  timestampOutput.value = renderDateResult(now);
  setTimestampStatus("Date actuelle insérée.", "success");
}

function clearTimestamp() {
  timestampInput.value = "";
  timestampOutput.value = "";
  setTimestampStatus("En attente.", "default");
}

function setupTimeCalculator() {
  if (!durationValueInput || !timestampInput) return;

  convertDuration();
  runTimestampTool();

  durationConvertButton?.addEventListener("click", convertDuration);
  durationSwapButton?.addEventListener("click", swapDurationUnits);
  durationClearButton?.addEventListener("click", clearDuration);
  durationValueInput?.addEventListener("input", convertDuration);
  durationFromSelect?.addEventListener("change", convertDuration);
  durationToSelect?.addEventListener("change", convertDuration);

  durationCopyButton?.addEventListener("click", async () => {
    if (!durationOutput.value.trim()) {
      setDurationStatus("Aucun résultat à copier.", "warning");
      return;
    }

    await copyToClipboard(durationOutput.value);
    temporarilyChangeText(durationCopyButton, "Copié");
    setDurationStatus("Résultat copié.", "success");
  });

  timestampRunButton?.addEventListener("click", runTimestampTool);
  timestampNowButton?.addEventListener("click", fillCurrentDate);
  timestampClearButton?.addEventListener("click", clearTimestamp);
  timestampInput?.addEventListener("input", runTimestampTool);
  timestampModeSelect?.addEventListener("change", runTimestampTool);

  timestampCopyButton?.addEventListener("click", async () => {
    if (!timestampOutput.value.trim()) {
      setTimestampStatus("Aucun résultat à copier.", "warning");
      return;
    }

    await copyToClipboard(timestampOutput.value);
    temporarilyChangeText(timestampCopyButton, "Copié");
    setTimestampStatus("Résultat copié.", "success");
  });
}

setupTimeCalculator();
