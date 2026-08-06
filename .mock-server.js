// 临时验证服务器：静态文件 + mock auth（登录页 CSS 移动端排查）
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/api/auth') return json(res, 200, { token: 'mock-token-123', username: 'admin' });
  if (p.startsWith('/api/')) return json(res, 200, {});
  let filePath = path.join(ROOT, p);
  if (p === '/' || p === '') filePath = path.join(ROOT, 'index.html');
  else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  else if (!fs.existsSync(filePath)) filePath = path.join(ROOT, 'index.html');
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(4013, () => console.log('mock on http://localhost:4013'));
