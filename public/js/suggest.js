import { setStatus } from "./utils.js";

const COOLDOWN_MS = 30 * 60 * 1000;
const COOLDOWN_KEY = "soraToolsSuggestLastSubmit";

const form = document.querySelector("[data-suggest-form]");
const pseudoInput = document.querySelector("[data-suggest-pseudo]");
const toolNameInput = document.querySelector("[data-suggest-tool]");
const descriptionInput = document.querySelector("[data-suggest-description]");
const captchaQuestion = document.querySelector("[data-suggest-captcha-question]");
const captchaInput = document.querySelector("[data-suggest-captcha]");
const submitButton = document.querySelector("[data-suggest-submit]");
const statusElement = document.querySelector("[data-suggest-status]");
const cooldownElement = document.querySelector("[data-suggest-cooldown]");

let captchaAnswer = 0;
let cooldownTimer = null;
let emailJsConfig = null;

function setSuggestStatus(message, type = "default") {
  setStatus(statusElement, message, type);
}

function getSuggestTemplateId() {
  return emailJsConfig?.suggestTemplateId || emailJsConfig?.templateId || "";
}

function getLastSubmitTime() {
  return Number(localStorage.getItem(COOLDOWN_KEY)) || 0;
}

function getRemainingCooldown() {
  const elapsed = Date.now() - getLastSubmitTime();
  return Math.max(COOLDOWN_MS - elapsed, 0);
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function updateCooldownState() {
  const remaining = getRemainingCooldown();

  if (remaining > 0) {
    submitButton.disabled = true;
    cooldownElement.textContent = `Prochaine suggestion possible dans ${formatRemainingTime(remaining)}.`;
    return;
  }

  submitButton.disabled = false;
  cooldownElement.textContent = "Tu peux envoyer une suggestion.";

  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
}

function startCooldownTimer() {
  updateCooldownState();

  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(updateCooldownState, 1000);
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;

  captchaAnswer = a + b;
  captchaQuestion.textContent = `${a} + ${b} = ?`;
  captchaInput.value = "";
}

function isEmailJsConfigured() {
  return Boolean(
    emailJsConfig?.publicKey && emailJsConfig?.serviceId && getSuggestTemplateId(),
  );
}

async function loadEmailJsConfig() {
  try {
    const response = await fetch("/api/emailjs-config");
    const config = await response.json();

    if (!response.ok || !config.success) {
      throw new Error("EmailJS config unavailable");
    }

    emailJsConfig = config;

    if (window.emailjs && isEmailJsConfigured()) {
      window.emailjs.init({ publicKey: emailJsConfig.publicKey });
      setSuggestStatus("Formulaire prêt.", "success");
      return;
    }

    setSuggestStatus("Config EmailJS suggestion manquante dans le .env.", "error");
  } catch (error) {
    setSuggestStatus("Impossible de charger la config EmailJS.", "error");
  }
}

function validateForm() {
  const pseudo = pseudoInput.value.trim();
  const toolName = toolNameInput.value.trim();
  const description = descriptionInput.value.trim();
  const captchaValue = Number(captchaInput.value.trim());

  if (!pseudo || !toolName || !description) {
    setSuggestStatus("Tous les champs sont obligatoires.", "warning");
    return false;
  }

  if (pseudo.length < 2 || pseudo.length > 40) {
    setSuggestStatus("Le pseudo doit faire entre 2 et 40 caractères.", "warning");
    return false;
  }

  if (toolName.length < 2 || toolName.length > 80) {
    setSuggestStatus("Le nom du tool doit faire entre 2 et 80 caractères.", "warning");
    return false;
  }

  if (description.length < 15 || description.length > 1500) {
    setSuggestStatus("La description doit faire entre 15 et 1500 caractères.", "warning");
    return false;
  }

  if (captchaValue !== captchaAnswer) {
    setSuggestStatus("Captcha incorrect.", "error");
    generateCaptcha();
    return false;
  }

  if (getRemainingCooldown() > 0) {
    setSuggestStatus("Cooldown actif : attends avant de renvoyer une suggestion.", "warning");
    return false;
  }

  if (!isEmailJsConfigured()) {
    setSuggestStatus("EmailJS suggestion n'est pas configuré dans le .env.", "error");
    return false;
  }

  if (!window.emailjs) {
    setSuggestStatus("EmailJS n'est pas chargé. Vérifie le script CDN.", "error");
    return false;
  }

  return true;
}

async function sendSuggestion(event) {
  event.preventDefault();

  if (!validateForm()) return;

  submitButton.disabled = true;
  setSuggestStatus("Envoi de la suggestion...", "default");

  const templateParams = {
    pseudo: pseudoInput.value.trim(),
    tool_name: toolNameInput.value.trim(),
    description: descriptionInput.value.trim(),
    submitted_at: new Date().toLocaleString("fr-FR"),
    page_url: window.location.href,
  };

  try {
    await window.emailjs.send(
      emailJsConfig.serviceId,
      getSuggestTemplateId(),
      templateParams,
    );

    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    form.reset();
    generateCaptcha();
    startCooldownTimer();
    setSuggestStatus("Suggestion envoyée avec succès. Merci !", "success");
  } catch (error) {
    submitButton.disabled = false;
    setSuggestStatus("Erreur lors de l'envoi. Vérifie ta config EmailJS.", "error");
  }
}

async function setupSuggestForm() {
  if (!form) return;

  submitButton.disabled = true;
  generateCaptcha();
  startCooldownTimer();
  await loadEmailJsConfig();
  updateCooldownState();
  form.addEventListener("submit", sendSuggestion);
}

setupSuggestForm();
