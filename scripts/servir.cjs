const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8' };

//Servidor local
const servidor = http.createServer((req, res) => {
    let ruta;
    try { ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (ruta === '/') ruta = '/index.html';
    if (!(ruta === '/index.html' || /^\/(css|js)\/[a-zA-Z0-9_.-]+\.(css|js)$/.test(ruta))) {
        res.writeHead(404).end('Archivo no disponible'); return;
    }
    fs.readFile(path.join(root, ruta), (error, contenido) => {
        if (error) { res.writeHead(404).end('Archivo no disponible'); return; }
        res.writeHead(200, { 'Content-Type': tipos[path.extname(ruta)], 'Cache-Control': 'no-store' });
        res.end(contenido);
    });
});
servidor.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
        ? 'El puerto 5173 está ocupado. Cierra el servidor anterior antes de iniciar otro.'
        : error.message);
    process.exitCode = 1;
});
servidor.listen(5173, '127.0.0.1', () => {
    console.log('Abre http://127.0.0.1:5173 — Ctrl+C para detener.');
});
