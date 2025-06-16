export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/status') {
      if (request.method === 'GET') {
        const data = await env.STATUS_KV.get('history');
        return new Response(data || '[]', {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (request.method === 'POST') {
        const payload = await request.json();
        await env.STATUS_KV.put('history', JSON.stringify(payload));
        return new Response('OK', { status: 200 });
      }
    }

    // Serve static assets
    return await getAssetFromKV(request);
  },
};
