const events = new Set(['visit', 'start', 'result_review', 'result_request', 'result', 'place_view', 'map', 'save', 'share', 'share_visit']);
function cleanEvent(body) {
  if (!body || !events.has(body.event)) return null;
  return { experiment: 'weekend-rules-v1', event: body.event,
    source: ['direct', 'search', 'share', 'guide', 'referral'].includes(body.source) ? body.source : 'direct' };
}
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const send = status => { res.statusCode = status; res.end(JSON.stringify({ ok: status === 200 })); };
  if (req.method !== 'POST') return send(405);
  try {
    if (new URL(req.headers.origin).host !== req.headers.host || !String(req.headers['content-type']).startsWith('application/json')) return send(403);
    let body = req.body;
    if (!body) {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 512) return send(413); }
      body = JSON.parse(raw);
    } else if (typeof body === 'string') body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body)) > 512) return send(413);
    const event = cleanEvent(body);
    if (!event) return send(400);
    // Deliberately no identity, IP, referrer URL, preferences, or location in event payloads.
    console.info(JSON.stringify(event));
    return send(200);
  } catch { return send(400); }
}
module.exports = handler;
module.exports.cleanEvent = cleanEvent;
