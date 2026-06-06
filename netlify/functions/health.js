const { CORS, json } = require('./_core');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  return json(200, {
    ok: true,
    name: 'Pulse Wave2 OS',
    generatedAt: new Date().toISOString(),
    netlifyFunctions: true,
    secretsExposedToClient: false,
    optionalServerKeysConfigured: {
      sosovalue: Boolean(process.env.SOSOVALUE_API_KEY),
      coingeckoDemo: Boolean(process.env.COINGECKO_DEMO_API_KEY),
      coingeckoPro: Boolean(process.env.COINGECKO_PRO_API_KEY),
      aiProvider: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY),
    },
  }, { 'Cache-Control': 'no-store' });
};
