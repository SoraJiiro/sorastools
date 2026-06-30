const REQUIRED_SUPABASE_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_JWKS_URL",
];

function assertSupabaseEnv() {
  const missingEnvVars = REQUIRED_SUPABASE_ENV_VARS.filter(
    (envVarName) => !process.env[envVarName],
  );

  if (missingEnvVars.length) {
    throw new Error(
      `Configuration Supabase incomplète : ${missingEnvVars.join(", ")}`,
    );
  }
}

function getExpressRequestUrl(req) {
  const protocol = req.protocol || "http";
  const host = req.get?.("host") || req.headers.host || "localhost";

  return `${protocol}://${host}${req.originalUrl || req.url}`;
}

function buildWebRequest(req) {
  const method = req.method || "GET";
  const headers = new Headers();

  Object.entries(req.headers || {}).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
      return;
    }

    if (value !== undefined) headers.set(name, String(value));
  });

  const requestInit = { method, headers };

  if (!["GET", "HEAD"].includes(method.toUpperCase())) {
    requestInit.body = JSON.stringify(req.body || {});
    headers.set("content-type", "application/json");
  }

  return new Request(getExpressRequestUrl(req), requestInit);
}

async function runSupabaseRequest(req, options, handler) {
  assertSupabaseEnv();

  const { withSupabase } = await import("@supabase/server");
  const supabaseHandler = withSupabase(options, handler);

  return supabaseHandler(buildWebRequest(req));
}

async function sendWebResponse(res, webResponse) {
  const contentType = webResponse.headers.get("content-type") || "";
  res.status(webResponse.status);

  if (contentType.includes("application/json")) {
    const json = await webResponse.json();
    return res.json(json);
  }

  const text = await webResponse.text();
  return res.send(text);
}

module.exports = {
  runSupabaseRequest,
  sendWebResponse,
};
