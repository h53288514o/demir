const express = require('express');
const { pipeline } = require('stream');
const { request, Agent } = require('undici');

const app = express();
const PORT = 4000;

const agent = new Agent({ keepAliveTimeout: 60000, keepAliveMaxTimeout: 60000 });

function filterHeaders(headers) {
  const hopByHop = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade'
  ]);
  const clean = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!hopByHop.has(k.toLowerCase())) clean[k] = v;
  }
  return clean;
}

app.use(async (req, res) => {
  try {
    const targetBase = req.path.startsWith('/php')
      ? 'http://23.95.200.174:8080'
      : 'http://23.95.200.174:6060';

    const targetUrl = new URL(req.originalUrl, targetBase);

    const { statusCode, headers, body } = await request(targetUrl.toString(), {
      method: req.method,
      headers: { ...filterHeaders(req.headers), host: 'picrypto.in' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      dispatcher: agent,
      maxRedirections: 0,
    });

    if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
      return res.redirect(statusCode, headers.location);
    }

    for (const [k, v] of Object.entries(headers)) {
      if (!['content-encoding', 'content-length'].includes(k.toLowerCase())) res.setHeader(k, v);
    }

    res.status(statusCode);
    pipeline(body, res, err => err && console.error(err));

  } catch (err) {
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
