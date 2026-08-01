const express = require("express");

const router = express.Router();
const DEFAULT_TIMEOUT_MS = 5000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PLATFORM_DEFINITIONS = [
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com/{username}",
    likelyTakenMarkers: ["<title>Sign in to GitHub", "<title>GitHub"],
  },
  {
    id: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/{username}",
    likelyTakenMarkers: [
      "This content isn't available",
      "Sorry, this page isn't available",
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/{username}",
    likelyTakenMarkers: [
      "Sorry, this page isn't available",
      "The link you followed may be broken",
    ],
  },
  {
    id: "snapchat",
    name: "Snapchat",
    url: "https://www.snapchat.com/add/{username}",
    likelyTakenMarkers: [
      "We couldn't find",
      "The page you requested could not be found",
    ],
  },
  {
    id: "x",
    name: "X / Twitter",
    url: "https://x.com/{username}",
    likelyTakenMarkers: ["This account doesn't exist"],
  },
  {
    id: "reddit",
    name: "Reddit",
    url: "https://www.reddit.com/user/{username}",
    likelyTakenMarkers: [
      "Sorry, nobody on Reddit goes by that name",
      "page not found",
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    url: "https://www.tiktok.com/@{username}",
    likelyTakenMarkers: [
      "Couldn't find this account",
      "This account doesn't exist",
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/@{username}",
    likelyTakenMarkers: ["This channel does not exist", "404"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    url: "https://www.linkedin.com/in/{username}",
    likelyTakenMarkers: ["Page not found", "This page isn’t available"],
  },
  {
    id: "steam",
    name: "Steam",
    url: "https://steamcommunity.com/id/{username}",
    likelyTakenMarkers: [
      "The specified profile could not be found",
      "profile not found",
    ],
  },
];

function getLookupTargetUrl(platform, username) {
  return platform.url.replace("{username}", encodeURIComponent(username));
}

function getStatusFromResponse(status, text = "", platform) {
  const normalized = text.toLowerCase();
  const likelyTakenMarkers = (platform?.likelyTakenMarkers || [])
    .map((marker) => marker.toLowerCase())
    .filter(Boolean);
  const likelyAvailableMarkers = [
    "page not found",
    "404",
    "not found",
    "this page is not available",
    "this page doesn't exist",
    "couldn't find",
    "no results",
    "doesn't exist",
    "user not found",
    "profile not found",
    "page doesn't exist",
    "not available",
    "sorry, this page isn't available",
    "the page you requested could not be found",
    "this content isn't available",
    "this account doesn't exist",
    "this channel does not exist",
    "the link you followed may be broken",
    "the specified profile could not be found",
  ];
  const positiveSignals = [
    "profile",
    "account",
    "channel",
    "user",
    "@",
    "follow",
  ];

  if (status === 200) {
    const hasLikelyTakenMarker = likelyTakenMarkers.some((marker) =>
      normalized.includes(marker),
    );
    if (hasLikelyTakenMarker) return "available";

    const hasLikelyAvailableMarker = likelyAvailableMarkers.some((marker) =>
      normalized.includes(marker),
    );
    if (hasLikelyAvailableMarker) return "available";

    const hasPositiveSignals = positiveSignals.some((signal) =>
      normalized.includes(signal),
    );
    if (hasPositiveSignals) return "taken";

    return "uncertain";
  }

  if (status === 404 || status === 410) return "available";

  return "unknown";
}

async function checkPlatformAvailability(platform, username) {
  const url = getLookupTargetUrl(platform, username);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const status = getStatusFromResponse(response.status, text, platform);

    return {
      id: platform.id,
      name: platform.name,
      url,
      status,
      httpStatus: response.status,
      message:
        status === "taken"
          ? "Signal fort : le profil ou la page semble exister."
          : status === "available"
            ? "Signal fort : le pseudo semble libre ou la page est introuvable."
            : status === "uncertain"
              ? "Signal faible : la réponse est ambiguë, à vérifier manuellement."
              : "Statut indéterminé, vérification limitée.",
    };
  } catch (error) {
    return {
      id: platform.id,
      name: platform.name,
      url,
      status: "unknown",
      httpStatus: null,
      message:
        error.name === "AbortError"
          ? "Délai de vérification dépassé."
          : "Impossible de vérifier cette plateforme.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

router.post("/api/username-lookup", async (req, res) => {
  const username = String(req.body?.username || "").trim();

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Veuillez entrer un pseudo à vérifier.",
    });
  }

  try {
    const results = await Promise.all(
      PLATFORM_DEFINITIONS.map((platform) =>
        checkPlatformAvailability(platform, username),
      ),
    );

    return res.json({
      success: true,
      username,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "La vérification a échoué.",
    });
  }
});

module.exports = router;
