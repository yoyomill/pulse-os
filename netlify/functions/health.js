exports.handler = async function handler() {
  return json({ ok: true, service: 'pulse-os', time: new Date().toISOString() });
};

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}
