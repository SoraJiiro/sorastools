const express = require("express");
const { execFileSync } = require("child_process");

const router = express.Router();
const PHP_CRYPT_SCRIPT = [
  "$data = json_decode(stream_get_contents(STDIN), true);",
  'if (!is_array($data)) { fwrite(STDERR, "Invalid payload"); exit(2); }',
  '$result = crypt((string) ($data["text"] ?? ""), (string) ($data["salt"] ?? ""));',
  'if ($result === "" || str_starts_with($result, "*")) { fwrite(STDERR, "Invalid salt"); exit(3); }',
  "echo $result;",
].join(" ");

function isValidCryptRequest(text, salt) {
  return (
    typeof text === "string" &&
    typeof salt === "string" &&
    text.length <= 4096 &&
    salt.length > 0 &&
    salt.length <= 256 &&
    !/[\u0000-\u001f\u007f]/.test(salt)
  );
}

router.post("/api/crypt", (req, res) => {
  const text = req.body?.text;
  const salt = req.body?.salt;

  if (!isValidCryptRequest(text, salt)) {
    return res.status(400).json({
      success: false,
      message: "Le texte ou le SEL est invalide ou trop long.",
    });
  }

  try {
    const result = execFileSync(
      process.env.PHP_BINARY || "php",
      ["-r", PHP_CRYPT_SCRIPT],
      {
        input: JSON.stringify({ text, salt }),
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
        maxBuffer: 2048,
      },
    ).trim();

    return res.json({ success: true, hash: result });
  } catch (error) {
    return res.status(422).json({
      success: false,
      message: "Le SEL n’est pas accepté par crypt() sur ce serveur.",
    });
  }
});

module.exports = router;
