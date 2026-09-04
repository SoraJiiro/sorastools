import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const typeInput = document.querySelector("[data-gradient-type]");
const angleInput = document.querySelector("[data-gradient-angle]");
const shapeInput = document.querySelector("[data-gradient-shape]");
const angleField = document.querySelector("[data-gradient-angle-field]");
const shapeField = document.querySelector("[data-gradient-shape-field]");
const stopsContainer = document.querySelector("[data-gradient-stops]");
const preview = document.querySelector("[data-gradient-preview]");
const output = document.querySelector("[data-gradient-output]");
const addButton = document.querySelector("[data-gradient-add]");
const copyButton = document.querySelector("[data-gradient-copy]");
const resetButton = document.querySelector("[data-gradient-reset]");
const status = document.querySelector("[data-gradient-status]");

let stops = [
  { color: "#ff7a00", position: 0 },
  { color: "#ffcc66", position: 50 },
  { color: "#4c1d95", position: 100 },
];

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

function getGradient() {
  const values = stops
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
  if (typeInput.value === "radial")
    return `radial-gradient(${shapeInput.value}, ${values})`;
  if (typeInput.value === "conic")
    return `conic-gradient(from ${angleInput.value}deg, ${values})`;
  return `linear-gradient(${angleInput.value}deg, ${values})`;
}

function renderStops() {
  stopsContainer.innerHTML = stops
    .map(
      (stop, index) => `
    <div class="gradient-stop" data-stop-index="${index}">
      <div class="stop-color-inputs">
        <input type="color" value="${stop.color}" data-stop-color aria-label="Couleur du stop ${index + 1}">
        <input type="text" value="${stop.color}" data-stop-color-hex inputmode="text" maxlength="7" pattern="#[0-9a-fA-F]{3,6}" aria-label="Couleur HEX du stop ${index + 1}">
      </div>
      <input type="range" min="0" max="100" value="${stop.position}" data-stop-position aria-label="Position du stop ${index + 1}">
      <output data-stop-value>${stop.position}%</output>
      <button type="button" data-stop-remove aria-label="Supprimer le stop ${index + 1}" ${stops.length <= 2 ? "disabled" : ""}>Supprimer</button>
    </div>
  `,
    )
    .join("");

  stopsContainer.querySelectorAll(".gradient-stop").forEach((row) => {
    const index = Number(row.dataset.stopIndex);
    row
      .querySelector("[data-stop-color]")
      .addEventListener("input", (event) => {
        stops[index].color = event.target.value;
        row.querySelector("[data-stop-color-hex]").value = event.target.value;
        updateTool();
      });
    row
      .querySelector("[data-stop-color-hex]")
      .addEventListener("input", (event) => {
        const color = normalizeHex(event.target.value);
        if (!color) return;
        stops[index].color = color;
        row.querySelector("[data-stop-color]").value = color;
        event.target.value = color;
        updateTool();
      });
    row
      .querySelector("[data-stop-position]")
      .addEventListener("input", (event) => {
        stops[index].position = Number(event.target.value);
        row.querySelector("[data-stop-value]").textContent =
          `${stops[index].position}%`;
        updateTool();
      });
    row.querySelector("[data-stop-remove]").addEventListener("click", () => {
      stops.splice(index, 1);
      renderStops();
      updateTool();
    });
  });
}

function updateTool() {
  const gradient = getGradient();
  document.querySelector("[data-gradient-angle-value]").textContent =
    `${angleInput.value}deg`;
  angleField.hidden = typeInput.value === "radial";
  shapeField.hidden = typeInput.value !== "radial";
  preview.style.background = gradient;
  output.textContent = `.element {\n  background: ${gradient};\n}`;
  document.dispatchEvent(new CustomEvent("sorastool:content-updated"));
}

function resetTool() {
  typeInput.value = "linear";
  angleInput.value = 135;
  shapeInput.value = "circle";
  stops = [
    { color: "#ff7a00", position: 0 },
    { color: "#ffcc66", position: 50 },
    { color: "#4c1d95", position: 100 },
  ];
  renderStops();
  updateTool();
  setStatus(status, "Générateur réinitialisé.", "success");
}

typeInput.addEventListener("input", updateTool);
angleInput.addEventListener("input", updateTool);
shapeInput.addEventListener("input", updateTool);
addButton.addEventListener("click", () => {
  stops.splice(stops.length - 1, 0, { color: "#ffffff", position: 75 });
  renderStops();
  updateTool();
});
resetButton.addEventListener("click", resetTool);
copyButton.addEventListener("click", async () => {
  await copyToClipboard(output.textContent);
  temporarilyChangeText(copyButton, "Copié");
  setStatus(status, "CSS copié dans le presse-papiers.", "success");
});
renderStops();
updateTool();
