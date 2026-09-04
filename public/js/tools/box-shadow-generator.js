import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const selectors = {
  x: document.querySelector("[data-shadow-x]"),
  y: document.querySelector("[data-shadow-y]"),
  blur: document.querySelector("[data-shadow-blur]"),
  spread: document.querySelector("[data-shadow-spread]"),
  opacity: document.querySelector("[data-shadow-opacity]"),
  color: document.querySelector("[data-shadow-color]"),
  colorHex: document.querySelector("[data-shadow-color-hex]"),
  inset: document.querySelector("[data-shadow-inset]"),
  previewBackground: document.querySelector("[data-shadow-preview-background]"),
  previewWrap: document.querySelector("[data-shadow-preview-wrap]"),
  preview: document.querySelector("[data-shadow-preview]"),
  output: document.querySelector("[data-shadow-output]"),
  copy: document.querySelector("[data-shadow-copy]"),
  reset: document.querySelector("[data-shadow-reset]"),
  status: document.querySelector("[data-shadow-status]"),
};

function toRgba(hex, opacity) {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${(opacity / 100).toFixed(2)})`;
}

function getShadow() {
  const inset = selectors.inset.checked ? "inset " : "";
  return `${inset}${selectors.x.value}px ${selectors.y.value}px ${selectors.blur.value}px ${selectors.spread.value}px ${toRgba(selectors.color.value, Number(selectors.opacity.value))}`;
}

function updateLabels() {
  ["x", "y", "blur", "spread"].forEach((key) => {
    document.querySelector(`[data-shadow-${key}-value]`).textContent =
      `${selectors[key].value}px`;
  });
  document.querySelector("[data-shadow-opacity-value]").textContent =
    `${selectors.opacity.value}%`;
}

function updateTool() {
  const shadow = getShadow();
  updateLabels();
  selectors.preview.style.boxShadow = shadow;
  selectors.previewWrap.dataset.background = selectors.previewBackground.value;
  selectors.output.textContent = `.element {\n  box-shadow: ${shadow};\n}`;
  document.dispatchEvent(new CustomEvent("sorastool:content-updated"));
}

function resetTool() {
  selectors.x.value = 12;
  selectors.y.value = 18;
  selectors.blur.value = 30;
  selectors.spread.value = 0;
  selectors.opacity.value = 35;
  selectors.color.value = getPrimaryColor();
  selectors.colorHex.value = selectors.color.value;
  selectors.inset.checked = false;
  selectors.previewBackground.value = "dark";
  updateTool();
  setStatus(selectors.status, "Générateur réinitialisé.", "success");
}

function getPrimaryColor() {
  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  return /^#[0-9a-f]{6}$/i.test(primary) ? primary : "#ff7a00";
}

function normalizeHex(value) {
  const hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex))
    return `#${hex
      .slice(1)
      .split("")
      .map((character) => character + character)
      .join("")}`;
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : null;
}

if (selectors.preview && selectors.output) {
  selectors.color.value = getPrimaryColor();
  selectors.colorHex.value = selectors.color.value;
  [
    selectors.x,
    selectors.y,
    selectors.blur,
    selectors.spread,
    selectors.opacity,
    selectors.color,
    selectors.inset,
    selectors.previewBackground,
  ].forEach((input) => input.addEventListener("input", updateTool));
  selectors.color.addEventListener("input", () => {
    selectors.colorHex.value = selectors.color.value;
  });
  selectors.colorHex.addEventListener("input", () => {
    const color = normalizeHex(selectors.colorHex.value);
    if (!color) return;
    selectors.color.value = color;
    updateTool();
  });
  selectors.reset.addEventListener("click", resetTool);
  selectors.copy.addEventListener("click", async () => {
    await copyToClipboard(selectors.output.textContent);
    temporarilyChangeText(selectors.copy, "Copié");
    setStatus(selectors.status, "CSS copié dans le presse-papiers.", "success");
  });
  updateTool();
}
