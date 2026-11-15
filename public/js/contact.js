import { setStatus } from "./utils.js";
import { createAdditionCaptcha, createCooldown } from "./formSupport.js";

const COOLDOWN_KEY = "soraToolContactLastSubmit";

const form = document.querySelector("[data-contact-form]");
const nameInput = document.querySelector("[data-contact-name]");
const subjectInput = document.querySelector("[data-contact-subject]");
const messageInput = document.querySelector("[data-contact-message]");
const captchaQuestion = document.querySelector(
  "[data-contact-captcha-question]",
);
const captchaInput = document.querySelector("[data-contact-captcha]");
const submitButton = document.querySelector("[data-contact-submit]");
const statusElement = document.querySelector("[data-contact-status]");
const cooldownElement = document.querySelector("[data-contact-cooldown]");

let emailJsConfig = null;
const captcha = createAdditionCaptcha(captchaQuestion, captchaInput);
const cooldown = createCooldown({
  storageKey: COOLDOWN_KEY,
  submitButton,
  cooldownElement,
  waitingMessage: "Prochain message possible dans",
  readyMessage: "Tu peux envoyer un message.",
});

function setContactStatus(message, type = "default") {
  setStatus(statusElement, message, type);
}

function isEmailJsConfigured() {
  return Boolean(
    emailJsConfig?.publicKey &&
    emailJsConfig?.serviceId &&
    emailJsConfig?.contactTemplateId,
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
      setContactStatus("Formulaire prêt.", "success");
      return;
    }

    setContactStatus("Config EmailJS contact manquante dans le .env.", "error");
  } catch (error) {
    setContactStatus("Impossible de charger la config EmailJS.", "error");
  }
}

function validateForm() {
  const name = nameInput.value.trim();
  const subject = subjectInput.value.trim();
  const message = messageInput.value.trim();
  const captchaValue = Number(captchaInput.value.trim());

  if (!name || !subject || !message) {
    setContactStatus("Tous les champs sont obligatoires.", "warning");
    return false;
  }

  if (name.length < 2 || name.length > 60) {
    setContactStatus("Le nom doit faire entre 2 et 60 caractères.", "warning");
    return false;
  }

  if (subject.length < 2 || subject.length > 100) {
    setContactStatus(
      "Le sujet doit faire entre 2 et 100 caractères.",
      "warning",
    );
    return false;
  }

  if (message.length < 15 || message.length > 2000) {
    setContactStatus(
      "Le message doit faire entre 15 et 2000 caractères.",
      "warning",
    );
    return false;
  }

  if (!captcha.isCorrect(captchaValue)) {
    setContactStatus("Captcha incorrect.", "error");
    captcha.reset();
    return false;
  }

  if (cooldown.getRemaining() > 0) {
    setContactStatus(
      "Cooldown actif : attends avant de renvoyer un message.",
      "warning",
    );
    return false;
  }

  if (!isEmailJsConfigured()) {
    setContactStatus(
      "EmailJS contact n'est pas configuré dans le .env.",
      "error",
    );
    return false;
  }

  if (!window.emailjs) {
    setContactStatus(
      "EmailJS n'est pas chargé. Vérifie le script CDN.",
      "error",
    );
    return false;
  }

  return true;
}

async function sendContactMessage(event) {
  event.preventDefault();

  if (!validateForm()) return;

  submitButton.disabled = true;
  setContactStatus("Envoi du message...", "default");

  const templateParams = {
    name: nameInput.value.trim(),
    subject: subjectInput.value.trim(),
    message: messageInput.value.trim(),
    date: new Date().toLocaleString("fr-FR"),
  };

  try {
    await window.emailjs.send(
      emailJsConfig.serviceId,
      emailJsConfig.contactTemplateId,
      templateParams,
    );

    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    form.reset();
    captcha.reset();
    cooldown.start();
    setContactStatus("Message envoyé avec succès. Merci !", "success");
  } catch (error) {
    submitButton.disabled = false;
    setContactStatus(
      "Erreur lors de l'envoi. Vérifie ta config EmailJS.",
      "error",
    );
  }
}

async function setupContactForm() {
  if (!form) return;

  submitButton.disabled = true;
  captcha.reset();
  cooldown.start();
  await loadEmailJsConfig();
  cooldown.update();
  form.addEventListener("submit", sendContactMessage);

  if (submitButton.disabled) {
    setContactStatus("Formulaire en cooldown ...", "default");
  }
}

setupContactForm();
