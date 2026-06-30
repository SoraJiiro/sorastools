const express = require("express");
const readJsonFile = require("../../utils/readJsonFile");
const { TOOLS_FILE } = require("../../config/paths");

const router = express.Router();
const TOOL_USAGE_TABLE = "tool_usage_counts";
const TOOL_USAGE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const TOOL_USAGE_LIMIT_MAX_CLICKS = 5;
const toolUsageRateLimits = new Map();
const SUPABASE_REST_HEADERS = {
  apikey: "",
  Authorization: "",
  "Content-Type": "application/json",
};

async function getTools() {
  const data = await readJsonFile(TOOLS_FILE, []);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tools)) return data.tools;

  return [];
}

function shouldPreventSubmitCount() {
  return (
    String(process.env.PREVENT_SUBMIT_COUNT_SUPA || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getReadyTools(tools) {
  return tools.filter((tool) => tool.status === "ready");
}

function mapMostUsedTools(tools, usageRows = []) {
  const readyTools = getReadyTools(tools);
  const toolsById = new Map(readyTools.map((tool) => [tool.id, tool]));

  const rankedTools = usageRows
    .map((usageRow) => {
      const tool = toolsById.get(usageRow.tool_id);
      if (!tool) return null;

      return {
        ...tool,
        submitCount: Number(usageRow.submit_count || 0),
      };
    })
    .filter(Boolean);

  const rankedToolIds = new Set(rankedTools.map((tool) => tool.id));
  const fallbackTools = readyTools
    .filter((tool) => !rankedToolIds.has(tool.id))
    .slice(0, Math.max(0, 3 - rankedTools.length))
    .map((tool) => ({ ...tool, submitCount: 0 }));

  return [...rankedTools, ...fallbackTools].slice(0, 3);
}

function isToolUsageRateLimited(req, toolId) {
  const now = Date.now();
  const key = `${req.ip || "anonymous"}:${toolId}`;
  const clicks = (toolUsageRateLimits.get(key) || []).filter(
    (timestamp) => now - timestamp < TOOL_USAGE_LIMIT_WINDOW_MS,
  );

  if (clicks.length >= TOOL_USAGE_LIMIT_MAX_CLICKS) {
    toolUsageRateLimits.set(key, clicks);
    return true;
  }

  clicks.push(now);
  toolUsageRateLimits.set(key, clicks);
  return false;
}

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secretKey = process.env.SUPABASE_SECRET_KEY || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const apiKey = serviceRoleKey || secretKey || anonKey || publishableKey;

  if (!url || !apiKey) {
    throw new Error(
      "Configuration Supabase incomplète : SUPABASE_URL et une clé Supabase sont requis.",
    );
  }

  return { url, apiKey };
}

function getSupabaseHeaders() {
  const { apiKey } = getSupabaseConfig();

  return {
    ...SUPABASE_REST_HEADERS,
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
}

function getSupabaseEnvStatus() {
  return {
    preventSubmitCount: shouldPreventSubmitCount(),
    hasUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    hasPublishableKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
  };
}

async function readSupabaseJson(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
}

function logSupabaseStatsError(context, error) {
  console.warn(`[SoraTools] Stats Supabase ignorées (${context}) :`, error.message);
}

async function getSupabaseMostUsedTools(tools) {
  const { url } = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "tool_id,submit_count",
    order: "submit_count.desc",
    limit: "3",
  });

  const response = await fetch(`${url}/rest/v1/${TOOL_USAGE_TABLE}?${query}`, {
    headers: getSupabaseHeaders(),
  });
  const data = await readSupabaseJson(response);

  if (!response.ok) {
    throw new Error(
      data?.message || "Impossible de charger les stats Supabase.",
    );
  }

  return mapMostUsedTools(tools, Array.isArray(data) ? data : []);
}

async function incrementSupabaseToolUsage(toolId) {
  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/increment_tool_usage`, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({ p_tool_id: toolId }),
  });
  const data = await readSupabaseJson(response);

  if (!response.ok) {
    throw new Error(
      data?.message || "Impossible d'incrémenter les stats Supabase.",
    );
  }

  const usageRow = Array.isArray(data) ? data[0] : data;

  return Number(usageRow?.submit_count || 0);
}

router.get("/api/tools", async (req, res) => {
  const tools = await getTools();
  res.json({ success: true, tools });
});

router.get("/api/tools/most-used", async (req, res) => {
  const tools = await getTools();

  try {
    const mostUsedTools = await getSupabaseMostUsedTools(tools);
    return res.json({ success: true, tools: mostUsedTools });
  } catch (error) {
    logSupabaseStatsError("most-used", error);

    return res.json({
      success: true,
      fallback: true,
      message:
        error.message || "Supabase n'est pas encore configuré pour les stats.",
      tools: mapMostUsedTools(tools),
    });
  }
});

router.get("/api/tools/debug/supabase", async (req, res) => {
  const env = getSupabaseEnvStatus();

  try {
    const { url } = getSupabaseConfig();
    const query = new URLSearchParams({ select: "tool_id,submit_count", limit: "1" });
    const response = await fetch(`${url}/rest/v1/${TOOL_USAGE_TABLE}?${query}`, {
      headers: getSupabaseHeaders(),
    });
    const data = await readSupabaseJson(response);

    return res.json({
      success: response.ok,
      env,
      supabaseStatus: response.status,
      supabaseOk: response.ok,
      data,
    });
  } catch (error) {
    return res.json({
      success: false,
      env,
      message: error.message,
    });
  }
});

router.post("/api/tools/:toolId/submit", async (req, res) => {
  const tools = await getTools();
  const toolId = req.params.toolId;
  const tool = tools.find(
    (item) => item.id === toolId && item.status === "ready",
  );

  if (!tool) {
    return res.status(404).json({
      success: false,
      message: "Tool introuvable ou indisponible.",
    });
  }

  if (shouldPreventSubmitCount()) {
    return res.json({
      success: true,
      disabled: true,
      message: "Le comptage des submits Supabase est désactivé.",
    });
  }

  if (isToolUsageRateLimited(req, toolId)) {
    return res.json({
      success: true,
      rateLimited: true,
      toolId,
      message: "Limite atteinte : 5 actions comptabilisées par tool et par heure.",
    });
  }

  try {
    const submitCount = await incrementSupabaseToolUsage(toolId);
    return res.json({ success: true, toolId, submitCount });
  } catch (error) {
    logSupabaseStatsError(`submit ${toolId}`, error);

    return res.json({
      success: true,
      fallback: true,
      toolId,
      message:
        error.message || "Supabase n'est pas encore configuré pour les stats.",
    });
  }
});

module.exports = router;
