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

router.get("/tools/color-picker", (req, res) => {
  sendPublicFile(res, "tools", "color-picker.html");
});

router.get("/tools/json-formatter", (req, res) => {
  sendPublicFile(res, "tools", "json-formatter.html");
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

router.use((req, res) => {
  res.status(404);
  sendPublicFile(res, "404.html");
});

module.exports = router;
