/* Tiny static server so the prototype can be opened on a phone over Wi-Fi.
   Usage: node tools/serve.js [port]   then open http://<your-pc-ip>:8080/SlitherDrop.html on the phone. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const port = parseInt(process.argv[2], 10) || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown' };

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = fs.existsSync(path.join(root, 'SlitherDrop.html')) ? '/SlitherDrop.html' : '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => {
  console.log('SlitherDrop server running:');
  console.log('  desktop: http://localhost:' + port + '/');
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) console.log('  phone (same Wi-Fi): http://' + a.address + ':' + port + '/   [' + name + ']');
    }
  }
});
