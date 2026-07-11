#!/usr/bin/env node

function rootUrl(baseUrl) {
  return String(baseUrl).replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

export async function checkHermes({
  baseUrl = process.env.HERMES_API_URL || 'http://127.0.0.1:8642/v1',
  apiKey = process.env.HERMES_API_KEY || '',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) return { available: false, reason: 'HERMES_API_KEY is not configured' };
  const headers = { Authorization: `Bearer ${apiKey}` };
  try {
    const healthResponse = await fetchImpl(`${rootUrl(baseUrl)}/health`, { headers });
    if (!healthResponse.ok) return { available: false, reason: `health HTTP ${healthResponse.status}` };
    const [modelsResponse, capabilitiesResponse] = await Promise.all([
      fetchImpl(`${baseUrl}/models`, { headers }),
      fetchImpl(`${baseUrl}/capabilities`, { headers }),
    ]);
    const models = modelsResponse.ok ? await modelsResponse.json() : null;
    const capabilities = capabilitiesResponse.ok ? await capabilitiesResponse.json() : null;
    return {
      available: true,
      model: models?.data?.[0]?.id || null,
      capabilities: capabilities?.features || {},
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await checkHermes();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.available ? 0 : 1;
}
