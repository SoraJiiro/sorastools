import { setStatus } from "../utils.js";

const input = document.querySelector("[data-qr-input]");
const level = document.querySelector("[data-qr-level]");
const size = document.querySelector("[data-qr-size]");
const image = document.querySelector("[data-qr-image]");
const emptyState = document.querySelector("[data-qr-empty]");
const status = document.querySelector("[data-qr-status]");
const download = document.querySelector("[data-qr-download]");

let qrUrl = null;

function clearQr() {
  if (qrUrl) URL.revokeObjectURL(qrUrl);
  qrUrl = null;
  image.hidden = true;
  image.removeAttribute("src");
  emptyState.hidden = false;
  download.href = "#";
  download.removeAttribute("download");
  download.setAttribute("aria-disabled", "true");
  download.tabIndex = -1;
}

function invalidateQr() {
  if (!qrUrl) return;
  clearQr();
  setStatus(status, "Réglages modifiés. Génère un nouveau QR code.");
}

function generateQr() {
  const value = input.value.trim();
  if (!value) {
    clearQr();
    setStatus(status, "Entre un texte ou une URL.", "warning");
    return;
  }

  try {
    if (typeof window.qrcode !== "function") {
      throw new Error("Le générateur QR est indisponible.");
    }

    const qr = window.qrcode(0, level.value);
    qr.addData(value);
    qr.make();
    const svg = qr.createSvgTag({
      cellSize: Number(size.value),
      margin: 4,
      scalable: true,
    });

    clearQr();
    qrUrl = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    image.src = qrUrl;
    image.hidden = false;
    emptyState.hidden = true;
    download.href = qrUrl;
    download.download = "qrcode.svg";
    download.setAttribute("aria-disabled", "false");
    download.tabIndex = 0;
    setStatus(status, "QR code généré.", "success");
  } catch (error) {
    clearQr();
    setStatus(
      status,
      error.message || "Impossible de générer ce QR code.",
      "error",
    );
  }
}

function setupQrGenerator() {
  if (
    !input ||
    !level ||
    !size ||
    !image ||
    !emptyState ||
    !status ||
    !download
  )
    return;

  document
    .querySelector("[data-qr-generate]")
    ?.addEventListener("click", generateQr);
  input.addEventListener("input", invalidateQr);
  level.addEventListener("change", invalidateQr);
  size.addEventListener("change", invalidateQr);
}

setupQrGenerator();
