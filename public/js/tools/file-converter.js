import { setStatus } from "../utils.js";

const form = document.querySelector("[data-fc-form]");
const dropzone = document.querySelector("[data-fc-dropzone]");
const fileInput = document.querySelector("[data-fc-file]");
const fileName = document.querySelector("[data-fc-file-name]");
const fileMeta = document.querySelector("[data-fc-file-meta]");
const categorySelect = document.querySelector("[data-fc-category]");
const outputSelect = document.querySelector("[data-fc-output]");
const convertButton = document.querySelector("[data-fc-convert]");
const resetButton = document.querySelector("[data-fc-reset]");
const statusElement = document.querySelector("[data-fc-status]");
const downloadLink = document.querySelector("[data-fc-download]");
const progress = document.querySelector("[data-fc-progress]");

const OUTPUT_FORMATS = {
  auto: [
    { value: "jpg", label: "JPG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WEBP" },
    { value: "mp4", label: "MP4" },
    { value: "mp3", label: "MP3" },
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "DOCX" },
  ],
  image: [
    { value: "jpg", label: "JPG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WEBP" },
    { value: "avif", label: "AVIF" },
    { value: "tiff", label: "TIFF" },
    { value: "gif", label: "GIF" },
  ],
  video: [
    { value: "mp4", label: "MP4" },
    { value: "webm", label: "WEBM" },
    { value: "mkv", label: "MKV" },
    { value: "mov", label: "MOV" },
    { value: "avi", label: "AVI" },
    { value: "m4v", label: "M4V" },
    { value: "ogv", label: "OGV" },
  ],
  audio: [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "ogg", label: "OGG" },
    { value: "flac", label: "FLAC" },
    { value: "aac", label: "AAC" },
    { value: "m4a", label: "M4A" },
    { value: "opus", label: "OPUS" },
    { value: "webm", label: "WEBM audio" },
  ],
  document: [
    { value: "pdf", label: "PDF (Word → PDF)" },
    { value: "docx", label: "DOCX (PDF → Word)" },
  ],
};

function formatBytes(bytes = 0) {
  if (!bytes) return "0 o";

  const units = ["o", "Ko", "Mo", "Go"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getFilenameFromDisposition(disposition = "") {
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);

  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch ? basicMatch[1] : "converted-file";
}

function setFcStatus(message, type = "default") {
  setStatus(statusElement, message, type);
}

function setLoading(isLoading) {
  if (convertButton) convertButton.disabled = isLoading;
  if (progress) {
    progress.dataset.active = String(isLoading);
    progress.setAttribute("aria-hidden", String(!isLoading));
  }
}

function clearDownload() {
  if (!downloadLink) return;

  if (downloadLink.href && downloadLink.href.startsWith("blob:")) {
    URL.revokeObjectURL(downloadLink.href);
  }

  downloadLink.href = "#";
  downloadLink.hidden = true;
  downloadLink.removeAttribute("download");
}

function fillOutputFormats() {
  if (!outputSelect || !categorySelect) return;

  const formats = OUTPUT_FORMATS[categorySelect.value] || OUTPUT_FORMATS.auto;
  outputSelect.innerHTML = formats
    .map((format) => `<option value="${format.value}">${format.label}</option>`)
    .join("");
}

function updateFileLabel() {
  const file = fileInput?.files?.[0];

  if (!file) {
    fileName.textContent = "Choisir un fichier";
    fileMeta.textContent = "Glisse-dépose ou clique ici. Taille max serveur : 350 Mo.";
    return;
  }

  fileName.textContent = file.name;
  fileMeta.textContent = `${file.type || "Type inconnu"} · ${formatBytes(file.size)}`;
}

function resetForm() {
  form?.reset();
  fillOutputFormats();
  updateFileLabel();
  clearDownload();
  setFcStatus("En attente d'un fichier.");
}

async function convertFile(event) {
  event.preventDefault();
  clearDownload();

  const file = fileInput?.files?.[0];

  if (!file) {
    setFcStatus("Choisis un fichier à convertir.", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", categorySelect?.value || "auto");
  formData.append("outputFormat", outputSelect?.value || "");

  setLoading(true);
  setFcStatus("Conversion en cours...", "warning");

  try {
    const response = await fetch("/api/file-converter/convert", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || "Conversion impossible.");
    }

    const blob = await response.blob();
    const filename = getFilenameFromDisposition(response.headers.get("Content-Disposition") || "");
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.hidden = false;
    downloadLink.textContent = `Télécharger ${filename}`;
    downloadLink.click();

    setFcStatus("Conversion terminée.", "success");
  } catch (error) {
    setFcStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

if (form) {
  fillOutputFormats();

  categorySelect?.addEventListener("change", fillOutputFormats);
  fileInput?.addEventListener("change", updateFileLabel);
  form.addEventListener("submit", convertFile);
  resetButton?.addEventListener("click", resetForm);

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.dataset.drag = "true";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.dataset.drag = "false";
    });
  });

  dropzone?.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file || !fileInput) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    updateFileLabel();
  });
}
