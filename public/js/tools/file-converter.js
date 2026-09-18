import { setStatus } from "../utils.js";

const form = document.querySelector("[data-fc-form]");
const dropzone = document.querySelector("[data-fc-dropzone]");
const fileInput = document.querySelector("[data-fc-file]");
const fileName = document.querySelector("[data-fc-file-name]");
const fileMeta = document.querySelector("[data-fc-file-meta]");
const modeSelect = document.querySelector("[data-fc-mode]");
const categorySelect = document.querySelector("[data-fc-category]");
const outputSelect = document.querySelector("[data-fc-output]");
const outputField = document.querySelector("[data-fc-output-field]");
const convertButton = document.querySelector("[data-fc-convert]");
const resetButton = document.querySelector("[data-fc-reset]");
const statusElement = document.querySelector("[data-fc-status]");
const downloadLink = document.querySelector("[data-fc-download]");
const progress = document.querySelector("[data-fc-progress]");
const progressBar = progress?.querySelector("span");
const progressValue = document.querySelector("[data-fc-progress-value]");
const etaLabel = document.querySelector("[data-fc-eta]");

let processingTimer = null;
let etaStartedAt = 0;

const OUTPUT_FORMATS = {
  auto: [
    { value: "jpg", label: "JPG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WEBP" },
    { value: "mp4", label: "MP4" },
    { value: "mp3", label: "MP3" },
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "DOCX" },
    { value: "xlsx", label: "XLSX" },
    { value: "pptx", label: "PPTX" },
  ],
  image: [
    { value: "jpg", label: "JPG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WEBP" },
    { value: "avif", label: "AVIF" },
    { value: "tiff", label: "TIFF" },
    { value: "gif", label: "GIF" },
    { value: "ico", label: "ICO" },
  ],
  video: [
    { value: "mp4", label: "MP4" },
    { value: "webm", label: "WEBM" },
    { value: "mkv", label: "MKV" },
    { value: "mov", label: "MOV" },
    { value: "avi", label: "AVI" },
    { value: "m4v", label: "M4V" },
    { value: "ogv", label: "OGV" },
    { value: "mp3", label: "MP3 audio" },
    { value: "wav", label: "WAV audio" },
    { value: "ogg", label: "OGG audio" },
    { value: "flac", label: "FLAC audio" },
    { value: "aac", label: "AAC audio" },
    { value: "m4a", label: "M4A audio" },
    { value: "opus", label: "OPUS audio" },
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
    { value: "pdf", label: "PDF (Word/Excel/PowerPoint → PDF)" },
    { value: "docx", label: "DOCX (PDF → Word)" },
    { value: "odt", label: "ODT (PDF → OpenDocument Text)" },
    { value: "xlsx", label: "XLSX (PDF → Excel)" },
    { value: "ods", label: "ODS (PDF → OpenDocument Sheet)" },
    { value: "pptx", label: "PPTX (PDF → PowerPoint)" },
    { value: "odp", label: "ODP (PDF → OpenDocument Presentation)" },
  ],
};

function formatBytes(bytes = 0) {
  if (!bytes) return "0 o";

  const units = ["o", "Ko", "Mo", "Go"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
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

function formatEta(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "ETA: --";

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes > 0) {
    return `ETA: ${minutes}m ${remainingSeconds}s`;
  }

  return `ETA: ${remainingSeconds}s`;
}

function updateEta(percent) {
  if (!etaLabel) return;

  if (percent <= 0 || !etaStartedAt) {
    etaLabel.textContent = "ETA: --";
    return;
  }

  const elapsedSeconds = (Date.now() - etaStartedAt) / 1000;
  const remainingPercent = Math.max(0, 100 - percent);
  const estimate = elapsedSeconds * (remainingPercent / Math.max(percent, 1));

  etaLabel.textContent = formatEta(estimate);

  if (percent >= 100) {
    etaLabel.textContent = "ETA: 00s";
  }
}

function setProgress(value, label = "") {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  if (progressValue) {
    progressValue.textContent = `${Math.round(percent)}%`;
  }

  if (progress) {
    progress.dataset.value = String(percent);
    progress.setAttribute("aria-valuenow", String(percent));
    if (label) {
      progress.setAttribute("aria-label", label);
    }
  }

  updateEta(percent);
}

function setLoading(isLoading, value = 0) {
  if (convertButton) convertButton.disabled = isLoading;
  if (progress) {
    progress.dataset.active = String(isLoading);
    progress.setAttribute("aria-hidden", String(!isLoading));
  }

  if (isLoading) {
    etaStartedAt = Date.now();
    setProgress(value, "Conversion en cours");
    return;
  }

  setProgress(100, "Traitement terminé");
  if (etaLabel) etaLabel.textContent = "ETA: 00s";
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

  const isCompression = modeSelect?.value === "compress";

  if (outputField) {
    outputField.hidden = isCompression;
  }

  outputSelect.required = !isCompression;

  if (isCompression) {
    outputSelect.innerHTML = "";
    return;
  }

  const formats = OUTPUT_FORMATS[categorySelect.value] || OUTPUT_FORMATS.auto;
  outputSelect.innerHTML = formats
    .map((format) => `<option value="${format.value}">${format.label}</option>`)
    .join("");
}

function updateFileLabel() {
  const file = fileInput?.files?.[0];

  if (!file) {
    fileName.textContent = "Choisir un fichier";
    fileMeta.textContent =
      "Glisse-dépose ou clique ici. Taille max serveur : 350 Mo.";
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
  if (progressValue) progressValue.textContent = "0%";
  if (etaLabel) etaLabel.textContent = "ETA: --";
  setProgress(0, "En attente");
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

  const isCompression = modeSelect?.value === "compress";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", isCompression ? "compress" : "convert");
  formData.append("category", categorySelect?.value || "auto");
  formData.append("outputFormat", outputSelect?.value || "");

  if (processingTimer) {
    clearInterval(processingTimer);
    processingTimer = null;
  }

  etaStartedAt = Date.now();
  setLoading(true, 5);
  setFcStatus(
    isCompression
      ? "Compression en cours, veuillez patienter..."
      : "Conversion en cours, veuillez patienter...",
    "warning",
  );

  const xhr = new XMLHttpRequest();
  const startProcessingProgress = () => {
    let value = 35;
    processingTimer = setInterval(() => {
      value = Math.min(value + 8, 92);
      setProgress(value, "Traitement du fichier en cours");
    }, 700);
  };

  try {
    await new Promise((resolve, reject) => {
      xhr.open("POST", "/api/file-converter/convert", true);
      xhr.responseType = "blob";

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progressValue = Math.min(
          35,
          Math.round((event.loaded / event.total) * 35),
        );
        setProgress(progressValue, "Téléversement du fichier");
      };

      xhr.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progressValue =
          35 + Math.round((event.loaded / event.total) * 55);
        setProgress(Math.min(progressValue, 96), "Téléchargement du résultat");
      };

      xhr.onload = () => {
        if (xhr.status >= 400) {
          try {
            const errorPayload = JSON.parse(xhr.responseText || "{}");
            reject(new Error(errorPayload.message || "Conversion impossible."));
          } catch {
            reject(new Error("Conversion impossible."));
          }
          return;
        }

        clearInterval(processingTimer);
        processingTimer = null;
        setProgress(100, "Téléchargement du fichier");
        resolve();
      };

      xhr.onerror = () => {
        clearInterval(processingTimer);
        processingTimer = null;
        reject(new Error("La conversion a échoué."));
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 2 && !processingTimer) {
          startProcessingProgress();
        }
      };

      xhr.send(formData);
    });

    const filename = getFilenameFromDisposition(
      xhr.getResponseHeader("Content-Disposition") || "",
    );
    const url = URL.createObjectURL(xhr.response);

    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.hidden = false;
    downloadLink.textContent = `Télécharger ${filename}`;
    downloadLink.click();

    setFcStatus(
      isCompression ? "Compression terminée." : "Conversion terminée.",
      "success",
    );
  } catch (error) {
    clearInterval(processingTimer);
    processingTimer = null;
    setProgress(0, "Erreur de conversion");
    if (etaLabel) etaLabel.textContent = "ETA: --";
    setFcStatus(error.message, "error");
  } finally {
    setLoading(false, 100);
  }
}

if (form) {
  fillOutputFormats();

  modeSelect?.addEventListener("change", fillOutputFormats);
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
