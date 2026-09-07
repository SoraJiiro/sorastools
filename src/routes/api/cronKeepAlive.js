const express = require("express");
const router = express.Router();
const getReqContext = (req) =>
  `${req.protocol}://${req.get("host")}${req.originalUrl}`;

router.get("/api/keep-alive", (req, res) => {
  try {
    const reqContext = getReqContext(req);
    res.json({ message: "Keep-alive ping reçu [200]", context: reqContext });
  } catch (error) {
    console.error("Erreur lors du traitement de la requête:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});

module.exports = router;
