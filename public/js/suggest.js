import { setStatus } from "./utils.js";
import { createAdditionCaptcha, createCooldown } from "./formSupport.js";

const COOLDOWN_KEY = "soraToolSuggestLastSubmit";

const form = document.querySelector("[data-suggest-form]");
const pseudoInput = document.querySelector("[data-suggest-pseudo]");
const toolNameInput = document.querySelector("[data-suggest-tool]");
const descriptionInput = document.querySelector("[data-suggest-description]");
const captchaQuestion = document.querySelector(
  "[data-suggest-captcha-question]",
);
const captchaInput = document.querySelector("[data-suggest-captcha]");
const submitButton = document.querySelector("[data-suggest-submit]");
const statusElement = document.querySelector("[data-suggest-status]");
const cooldownElement = document.querySelector("[data-suggest-cooldown]");

let emailJsConfig = null;
const captcha = createAdditionCaptcha(captchaQuestion, captchaInput);
const cooldown = createCooldown({
  storageKey: COOLDOWN_KEY,
  submitButton,
  cooldownElement,
  waitingMessage: "Prochaine suggestion possible dans",
  readyMessage: "Tu peux envoyer une suggestion.",
});

function setSuggestStatus(message, type = "default") {
  setStatus(statusElement, message, type);
}

function getSuggestTemplateId() {
  return emailJsConfig?.suggestTemplateId || emailJsConfig?.templateId || "";
}

function isEmailJsConfigured() {
  return Boolean(
    emailJsConfig?.publicKey &&
    emailJsConfig?.serviceId &&
    getSuggestTemplateId(),
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

    setSuggestStatus(
      "Config EmailJS suggestion manquante dans le .env.",
      "error",
    );
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
    setSuggestStatus(
      "Le pseudo doit faire entre 2 et 40 caractères.",
      "warning",
    );
    return false;
  }

  if (toolName.length < 2 || toolName.length > 80) {
    setSuggestStatus(
      "Le nom du tool doit faire entre 2 et 80 caractères.",
      "warning",
    );
    return false;
  }

  if (description.length < 15 || description.length > 1500) {
    setSuggestStatus(
      "La description doit faire entre 15 et 1500 caractères.",
      "warning",
    );
    return false;
  }

  if (!captcha.isCorrect(captchaValue)) {
    setSuggestStatus("Captcha incorrect.", "error");
    captcha.reset();
    return false;
  }

  if (cooldown.getRemaining() > 0) {
    setSuggestStatus(
      "Cooldown actif : attends avant de renvoyer une suggestion.",
      "warning",
    );
    return false;
  }

  if (!isEmailJsConfigured()) {
    setSuggestStatus(
      "EmailJS suggestion n'est pas configuré dans le .env.",
      "error",
    );
    return false;
  }

  if (!window.emailjs) {
    setSuggestStatus(
      "EmailJS n'est pas chargé. Vérifie le script CDN.",
      "error",
    );
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
    date: new Date().toLocaleString("fr-FR"),
  };

  try {
    await window.emailjs.send(
      emailJsConfig.serviceId,
      getSuggestTemplateId(),
      templateParams,
    );

    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    form.reset();
    captcha.reset();
    cooldown.start();
    setSuggestStatus("Suggestion envoyée avec succès. Merci !", "success");
  } catch (error) {
    submitButton.disabled = false;
    setSuggestStatus(
      "Erreur lors de l'envoi. Vérifie ta config EmailJS.",
      "error",
    );
  }
}

async function setupSuggestForm() {
  if (!form) return;

  submitButton.disabled = true;
  captcha.reset();
  cooldown.start();
  await loadEmailJsConfig();
  cooldown.update();
  form.addEventListener("submit", sendSuggestion);
}

setupSuggestForm();
