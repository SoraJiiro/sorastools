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
    detection: {
      found: {
        status: [200],
        titleMarkers: ["github"],
        ogTitleMarkers: ["github"],
        canonicalMarkers: ["/github"],
        bodyKeywords: ["repositories", "followers", "following", "contributions", "pinned"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["sign in to github", "github"],
        canonicalMarkers: ["/login", "/signup"],
        bodyKeywords: ["page not found", "not found", "sign in to github"],
      },
    },
  },
  {
    id: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["facebook"],
        ogTitleMarkers: ["facebook"],
        bodyKeywords: ["posts", "friends", "photos", "videos"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["this content isn't available", "sorry, this page isn't available"],
        ogTitleMarkers: ["page not found"],
        bodyKeywords: ["this content isn't available", "page not found", "not available"],
      },
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["instagram"],
        ogTitleMarkers: ["instagram"],
        bodyKeywords: ["followers", "following", "posts", "stories", "profile"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["sorry, this page isn't available", "the link you followed may be broken"],
        ogTitleMarkers: ["page not found"],
        bodyKeywords: ["sorry, this page isn't available", "the link you followed may be broken", "not available"],
      },
    },
  },
  {
    id: "snapchat",
    name: "Snapchat",
    url: "https://www.snapchat.com/add/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["snapchat"],
        bodyKeywords: ["snapcode", "add me", "profile"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["we couldn't find", "the page you requested could not be found"],
        bodyKeywords: ["we couldn't find", "the page you requested could not be found", "not found"],
      },
    },
  },
  {
    id: "x",
    name: "X / Twitter",
    url: "https://x.com/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["x", "twitter"],
        bodyKeywords: ["posts", "followers", "following", "tweets"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["this account doesn't exist"],
        bodyKeywords: ["this account doesn't exist", "not found"],
      },
    },
  },
  {
    id: "reddit",
    name: "Reddit",
    url: "https://www.reddit.com/user/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["reddit"],
        bodyKeywords: ["posts", "comments", "karma", "redditor"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["sorry, nobody on reddit goes by that name", "page not found"],
        bodyKeywords: ["sorry, nobody on reddit goes by that name", "page not found", "not found"],
      },
    },
  },
  {
    id: "tiktok",
    name: "TikTok",
    url: "https://www.tiktok.com/@{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["tiktok"],
        bodyKeywords: ["followers", "following", "videos", "likes"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["couldn't find this account", "this account doesn't exist"],
        bodyKeywords: ["couldn't find this account", "this account doesn't exist", "not found"],
      },
    },
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/@{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["youtube"],
        bodyKeywords: ["videos", "subscriptions", "channel", "uploads"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["this channel does not exist", "404"],
        bodyKeywords: ["this channel does not exist", "404", "not found"],
      },
    },
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    url: "https://www.linkedin.com/in/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["linkedin"],
        bodyKeywords: ["experience", "about", "posts", "connections"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["page not found", "this page isn’t available"],
        bodyKeywords: ["page not found", "not available", "not found"],
      },
    },
  },
  {
    id: "steam",
    name: "Steam",
    url: "https://steamcommunity.com/id/{username}",
    detection: {
      found: {
        status: [200],
        titleMarkers: ["steam"],
        bodyKeywords: ["games", "inventory", "profile", "steamid"],
      },
      notFound: {
        status: [404],
        titleMarkers: ["the specified profile could not be found", "profile not found"],
        bodyKeywords: ["the specified profile could not be found", "profile not found", "not found"],
      },
    },
  },
];

const PROTECTION_PATTERNS = [
  "cloudflare",
  "cf-ray",
  "cf-mitigated",
  "captcha",
  "hcaptcha",
  "recaptcha",
  "akamai",
  "perimeterx",
  "challenge",
  "verifying you are human",
];

function getLookupTargetUrl(platform, username) {
  return platform.url.replace("{username}", encodeURIComponent(username));
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function parseTitle(html = "") {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

function parseMetaTag(html = "", propertyName) {
  if (!propertyName) return "";
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=['\"]${propertyName}['\"][^>]+content=['\"]([^'\"]+)['\"][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function parseCanonical(html = "") {
  const match = html.match(/<link[^>]+rel=['\"][^\"]*canonical[^\"]*['\"][^>]+href=['\"]([^'\"]+)['\"][^>]*>/i);
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function extractTextContent(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHtmlMetadata(html = "") {
  return {
    title: parseTitle(html),
    ogTitle: parseMetaTag(html, "og:title"),
    ogType: parseMetaTag(html, "og:type"),
    ogUrl: parseMetaTag(html, "og:url"),
    canonical: parseCanonical(html),
    bodyText: extractTextContent(html),
  };
}

function matchPatterns(value = "", patterns = []) {
  const normalizedValue = String(value || "").toLowerCase();
  return (patterns || []).some((pattern) =>
    normalizedValue.includes(String(pattern || "").toLowerCase()),
  );
}

function detectProtection(html = "", headers = {}) {
  const haystack = `${html || ""}\n${JSON.stringify(headers || {})}`.toLowerCase();

  if (PROTECTION_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    return {
      detected: true,
      reason: "Protection anti-bot détectée",
      confidence: 20,
    };
  }

  return null;
}

function classifyNetworkError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (error?.name === "AbortError") {
    return {
      reason: "Timeout",
      confidence: 0,
    };
  }

  if (message.includes("getaddrinfo") || message.includes("dns")) {
    return {
      reason: "Erreur DNS",
      confidence: 0,
    };
  }

  if (message.includes("tls") || message.includes("ssl") || message.includes("certificate")) {
    return {
      reason: "Erreur TLS",
      confidence: 0,
    };
  }

  if (message.includes("econnrefused") || message.includes("refused") || message.includes("network")) {
    return {
      reason: "Refus de connexion",
      confidence: 0,
    };
  }

  return {
    reason: "Erreur réseau",
    confidence: 0,
  };
}

function evaluatePlatform(response, extractedMetadata = {}, detectionRules = {}) {
  const foundRules = detectionRules.found || {};
  const notFoundRules = detectionRules.notFound || {};
  const foundSignals = [];
  const notFoundSignals = [];

  const addSignal = (bucket, kind, reason) => {
    bucket.push({ kind, reason });
  };

  const addKeywordSignals = (bucket, patterns, kind, prefix) => {
    (patterns || []).forEach((pattern) => {
      const normalizedPattern = String(pattern || "").toLowerCase();
      if (normalizedPattern && extractedMetadata.bodyText?.toLowerCase().includes(normalizedPattern)) {
        addSignal(bucket, kind, `${prefix}: ${pattern}`);
      }
    });
  };

  if (Array.isArray(foundRules.status) && foundRules.status.includes(response.status)) {
    addSignal(foundSignals, "status", `HTTP ${response.status}`);
  }

  if (Array.isArray(notFoundRules.status) && notFoundRules.status.includes(response.status)) {
    addSignal(notFoundSignals, "status", `HTTP ${response.status}`);
  }

  if (matchPatterns(extractedMetadata.title, foundRules.titleMarkers)) {
    addSignal(foundSignals, "title", "Matched title");
  }

  if (matchPatterns(extractedMetadata.title, notFoundRules.titleMarkers)) {
    addSignal(notFoundSignals, "title", "Matched notFound marker");
  }

  if (matchPatterns(extractedMetadata.ogTitle, foundRules.ogTitleMarkers)) {
    addSignal(foundSignals, "ogTitle", "Matched OG title");
  }

  if (matchPatterns(extractedMetadata.ogTitle, notFoundRules.ogTitleMarkers)) {
    addSignal(notFoundSignals, "ogTitle", "Matched OG title notFound marker");
  }

  if (matchPatterns(extractedMetadata.ogType, foundRules.ogTypeMarkers)) {
    addSignal(foundSignals, "ogType", "Matched OG type");
  }

  if (matchPatterns(extractedMetadata.ogUrl, foundRules.ogUrlMarkers)) {
    addSignal(foundSignals, "ogUrl", "Matched OG URL");
  }

  if (matchPatterns(extractedMetadata.canonical, foundRules.canonicalMarkers)) {
    addSignal(foundSignals, "canonical", "Matched canonical URL");
  }

  if (matchPatterns(extractedMetadata.canonical, notFoundRules.canonicalMarkers)) {
    addSignal(notFoundSignals, "canonical", "Matched canonical notFound marker");
  }

  addKeywordSignals(foundSignals, foundRules.bodyKeywords, "body", "Mot-clé HTML");
  addKeywordSignals(notFoundSignals, notFoundRules.bodyKeywords, "body", "Mot-clé HTML négatif");

  const redirectTarget = response.redirectLocation || response.locationHeader || "";
  if (matchPatterns(redirectTarget, foundRules.redirectMarkers)) {
    addSignal(foundSignals, "redirect", "Redirected to a known found target");
  }

  if (matchPatterns(redirectTarget, notFoundRules.redirectMarkers)) {
    addSignal(notFoundSignals, "redirect", "Redirected to login or notFound target");
  }

  if (matchPatterns(response.finalUrl || response.url, foundRules.urlMarkers)) {
    addSignal(foundSignals, "url", "Matched final URL");
  }

  if (matchPatterns(response.finalUrl || response.url, notFoundRules.urlMarkers)) {
    addSignal(notFoundSignals, "url", "Matched notFound URL");
  }

  const foundScore = foundSignals.length;
  const notFoundScore = notFoundSignals.length;

  if (foundScore > 0 && notFoundScore > 0) {
    return {
      decision: "UNKNOWN",
      confidence: 55,
      reason: `Signaux contradictoires (${foundScore} positifs / ${notFoundScore} négatifs)`,
    };
  }

  if (foundScore > 0) {
    const confidence = Math.min(95, 60 + foundScore * 8);
    return {
      decision: "FOUND",
      confidence,
      reason: foundSignals.map((signal) => signal.reason).join("; "),
    };
  }

  if (notFoundScore > 0) {
    const confidence = Math.min(95, 65 + notFoundScore * 7);
    return {
      decision: "NOT_FOUND",
      confidence,
      reason: notFoundSignals.map((signal) => signal.reason).join("; "),
    };
  }

  return {
    decision: "UNKNOWN",
    confidence: 40,
    reason: "Aucun signal de détection exploitable",
  };
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

    const html = await response.text();
    const extractedMetadata = extractHtmlMetadata(html);
    const protection = detectProtection(html, Object.fromEntries(response.headers.entries()));

    if (protection) {
      return {
        id: platform.id,
        name: platform.name,
        url,
        status: "unknown",
        decision: "UNKNOWN",
        confidence: protection.confidence,
        reason: protection.reason,
        httpStatus: response.status,
        message: "Protection anti-bot détectée. Le résultat est incertain.",
        redirectLocation: null,
      };
    }

    const evaluation = evaluatePlatform(
      {
        status: response.status,
        finalUrl: response.url,
        redirectLocation: response.headers.get("location")
          ? new URL(response.headers.get("location"), url).toString()
          : null,
        locationHeader: response.headers.get("location") || "",
      },
      {
        ...extractedMetadata,
        title: extractedMetadata.title,
        bodyText: extractedMetadata.bodyText,
      },
      platform.detection,
    );

    const status =
      evaluation.decision === "FOUND"
        ? "taken"
        : evaluation.decision === "NOT_FOUND"
          ? "available"
          : evaluation.confidence <= 20
            ? "unknown"
            : "uncertain";

    return {
      id: platform.id,
      name: platform.name,
      url,
      status,
      decision: evaluation.decision,
      confidence: evaluation.confidence,
      reason: evaluation.reason,
      httpStatus: response.status,
      redirectLocation: response.headers.get("location") || null,
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
    const networkError = classifyNetworkError(error);

    return {
      id: platform.id,
      name: platform.name,
      url,
      status: "unknown",
      decision: "UNKNOWN",
      confidence: networkError.confidence,
      reason: networkError.reason,
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
