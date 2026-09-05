const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;
const WEB_DIR = path.join(ROOT_DIR, 'web');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.sol': 'text/plain',
  '.md': 'text/markdown; charset=UTF-8',
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];

  // Health check endpoint
  if (reqUrl === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'paze', timestamp: new Date().toISOString() }));
    return;
  }

  // Default route -> web/index.html
  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/index.html';
  }

  // Determine file path
  let filePath;
  if (reqUrl.startsWith('/branding/') || reqUrl.startsWith('/dist/') || reqUrl.startsWith('/contracts/')) {
    filePath = path.join(ROOT_DIR, reqUrl);
  } else if (reqUrl.startsWith('/web/')) {
    filePath = path.join(ROOT_DIR, reqUrl);
  } else {
    filePath = path.join(WEB_DIR, reqUrl);
  }

  // Security check: ensure path is within ROOT_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to web/index.html for SPA routing if HTML requested
      const indexPath = path.join(WEB_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Set cache headers
    const headers = { 'Content-Type': contentType };
    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache';
    } else {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    res.writeHead(200, headers);
    fs.createReadStream(resolved).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PAZE Server] Live at http://0.0.0.0:${PORT}`);
});
