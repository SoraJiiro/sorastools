const express = require("express");
const path = require("path");
const { PUBLIC_DIR } = require("../config/paths");

const router = express.Router();

function sendPublicFile(res, ...segments) {
  res.sendFile(path.join(PUBLIC_DIR, ...segments));
}

router.get("/", (req, res) => {
  sendPublicFile(res, "index.html");
});

router.get("/suggest", (req, res) => {
  sendPublicFile(res, "suggest.html");
});

router.get("/contact", (req, res) => {
  sendPublicFile(res, "contact.html");
});

router.get("/api/emailjs-config", (req, res) => {
  res.json({
    success: true,
    publicKey: process.env.EMAILJS_PUBLIC_KEY || "",
    serviceId: process.env.EMAILJS_SERVICE_ID || "",
    suggestTemplateId:
      process.env.EMAILJS_SUGGEST_TEMPLATE_ID ||
      process.env.EMAILJS_TEMPLATE_ID ||
      "",
    contactTemplateId: process.env.EMAILJS_CONTACT_TEMPLATE_ID || "",
  });
});

router.get("/tools/color-picker", (req, res) => {
  sendPublicFile(res, "tools", "color-picker.html");
});

router.get("/tools/json-formatter", (req, res) => {
  res.redirect(301, "/tools/code-formatter");
});

router.get("/tools/code-formatter", (req, res) => {
  sendPublicFile(res, "tools", "code-formatter.html");
});

router.get("/tools/crypt-hasher", (req, res) => {
  sendPublicFile(res, "tools", "crypt-hasher.html");
});

router.get("/tools/regex-tester", (req, res) => {
  sendPublicFile(res, "tools", "regex-tester.html");
});

router.get("/tools/md-previewer", (req, res) => {
  sendPublicFile(res, "tools", "md-previewer.html");
});

router.get("/tools/base64", (req, res) => {
  sendPublicFile(res, "tools", "base64.html");
});

router.get("/tools/binary", (req, res) => {
  sendPublicFile(res, "tools", "binary.html");
});

router.get("/tools/hexadecimal", (req, res) => {
  sendPublicFile(res, "tools", "hexadecimal.html");
});

router.get("/tools/time-calculator", (req, res) => {
  sendPublicFile(res, "tools", "time-calculator.html");
});

router.get("/tools/clip-path-generator", (req, res) => {
  sendPublicFile(res, "tools", "clip-path-generator.html");
});

router.get("/tools/js-minifier", (req, res) => {
  sendPublicFile(res, "tools", "js-minifier.html");
});

router.get("/tools/file-converter", (req, res) => {
  sendPublicFile(res, "tools", "file-converter.html");
});

router.get("/tools/username-lookup", (req, res) => {
  sendPublicFile(res, "tools", "username-lookup.html");
});

router.get("/tools/chart-editor", (req, res) => {
  sendPublicFile(res, "tools", "chart-editor.html");
});

router.use((req, res) => {
  res.status(404);
  sendPublicFile(res, "404.html");
});

module.exports = router;
