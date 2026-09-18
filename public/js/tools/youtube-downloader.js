import { setStatus } from "../utils.js";

const form = document.querySelector("[data-yt-form]");
const urlInput = document.querySelector("[data-yt-url]");
const typeSelect = document.querySelector("[data-yt-type]");
const submitButton = document.querySelector("[data-yt-submit]");
const status = document.querySelector("[data-yt-status]");
const downloadLink = document.querySelector("[data-yt-download]");
const progressWrap = document.querySelector("[data-yt-progress-wrap]");
const progressBar = document.querySelector("[data-yt-progress-bar]");
const progressValue = document.querySelector("[data-yt-progress-value]");
const etaLabel = document.querySelector("[data-yt-eta]");

let downloadStartedAt = 0;

function getFilename(disposition = "") {
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : "youtube-download";
}

function clearDownload() {
  if (downloadLink?.href?.startsWith("blob:"))
    URL.revokeObjectURL(downloadLink.href);
  if (downloadLink) {
    downloadLink.hidden = true;
    downloadLink.removeAttribute("href");
    downloadLink.removeAttribute("download");
  }
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "ETA: --";
  const totalSeconds = Math.ceil(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  return minutes > 0
    ? `ETA: ${minutes}m ${totalSeconds % 60}s`
    : `ETA: ${totalSeconds}s`;
}

function updateProgress(loaded, total) {
  if (!total) return;
  const percent = Math.min(100, (loaded / total) * 100);
  const elapsed = (Date.now() - downloadStartedAt) / 1000;
  const remaining = elapsed * ((total - loaded) / Math.max(loaded, 1));

  progressBar.style.width = `${percent}%`;
  progressValue.textContent = `${Math.round(percent)}%`;
  etaLabel.textContent = percent >= 100 ? "ETA: 00s" : formatEta(remaining);
  progressBar.parentElement.setAttribute("aria-valuenow", String(percent));
}

function requestDownload(payload) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/youtube/download");
    request.responseType = "blob";
    request.setRequestHeader("Content-Type", "application/json");
    request.onprogress = (event) => updateProgress(event.loaded, event.total);
    request.onload = async () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request);
        return;
      }

      let message = "Téléchargement impossible.";
      try {
        message = JSON.parse(await request.response.text()).message || message;
      } catch {}
      reject(new Error(message));
    };
    request.onerror = () => reject(new Error("Connexion impossible."));
    request.send(JSON.stringify(payload));
  });
}

async function downloadMedia(event) {
  event.preventDefault();
  clearDownload();
  submitButton.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = "0%";
  progressValue.textContent = "0%";
  etaLabel.textContent = "ETA: --";
  downloadStartedAt = Date.now();
  setStatus(status, "Préparation du téléchargement...", "default");

  try {
    const response = await requestDownload({
      url: urlInput.value.trim(),
      type: typeSelect.value,
    });
    const blob = response.response;
    const href = URL.createObjectURL(blob);
    downloadLink.href = href;
    downloadLink.download = getFilename(
      response.headers.get("Content-Disposition"),
    );
    downloadLink.textContent = "Télécharger le résultat";
    downloadLink.hidden = false;
    updateProgress(1, 1);
    setStatus(status, "Prêt. Le téléchargement peut commencer.", "success");
  } catch (error) {
    setStatus(status, error.message || "Téléchargement impossible.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

form?.addEventListener("submit", downloadMedia);
