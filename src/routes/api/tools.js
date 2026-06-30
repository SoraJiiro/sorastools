const express = require("express");
const readJsonFile = require("../../utils/readJsonFile");
const { runSupabaseRequest, sendWebResponse } = require("../../utils/supabaseRequestHandler");
const { TOOLS_FILE } = require("../../config/paths");

const router = express.Router();
const TOOL_USAGE_TABLE = "tool_usage_counts";

async function getTools() {
  const data = await readJsonFile(TOOLS_FILE, []);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tools)) return data.tools;

  return [];
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

async function getSupabaseMostUsedTools(req, tools) {
  const response = await runSupabaseRequest(
    req,
    { auth: "none" },
    async (_request, ctx) => {
      const client = ctx.supabaseAdmin || ctx.supabase;
      const { data, error } = await client
        .from(TOOL_USAGE_TABLE)
        .select("tool_id, submit_count")
        .order("submit_count", { ascending: false })
        .limit(3);

      if (error) {
        return Response.json(
          { success: false, message: error.message },
          { status: 500 },
        );
      }

      return Response.json({
        success: true,
        tools: mapMostUsedTools(tools, data || []),
      });
    },
  );

  return response;
}

async function incrementSupabaseToolUsage(req, toolId) {
  const response = await runSupabaseRequest(
    req,
    { auth: "none" },
    async (_request, ctx) => {
      const client = ctx.supabaseAdmin || ctx.supabase;
      const { data, error } = await client.rpc("increment_tool_usage", {
        p_tool_id: toolId,
      });

      if (error) {
        return Response.json(
          { success: false, message: error.message },
          { status: 500 },
        );
      }

      const usageRow = Array.isArray(data) ? data[0] : data;

      return Response.json({
        success: true,
        toolId,
        submitCount: Number(usageRow?.submit_count || 0),
      });
    },
  );

  return response;
}

router.get("/api/tools", async (req, res) => {
  const tools = await getTools();
  res.json({ success: true, tools });
});

router.get("/api/tools/most-used", async (req, res) => {
  const tools = await getTools();

  try {
    const response = await getSupabaseMostUsedTools(req, tools);
    return sendWebResponse(res, response);
  } catch (error) {
    return res.json({
      success: true,
      fallback: true,
      message: "Supabase n'est pas encore configuré pour les stats.",
      tools: mapMostUsedTools(tools),
    });
  }
});

router.post("/api/tools/:toolId/submit", async (req, res) => {
  const tools = await getTools();
  const toolId = req.params.toolId;
  const tool = tools.find((item) => item.id === toolId && item.status === "ready");

  if (!tool) {
    return res.status(404).json({
      success: false,
      message: "Tool introuvable ou indisponible.",
    });
  }

  try {
    const response = await incrementSupabaseToolUsage(req, toolId);
    return sendWebResponse(res, response);
  } catch (error) {
    return res.status(503).json({
      success: false,
      fallback: true,
      message: "Supabase n'est pas encore configuré pour les stats.",
    });
  }
});

module.exports = router;
