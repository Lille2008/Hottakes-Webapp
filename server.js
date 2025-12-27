// 1. Basic Auth VOR ALLEM (kann ich entfernen, wenn ich öffentlich deployen möchte)
if (process.env.APP_PASSWORD) {
  const express = require('express');
  const app = express();

  app.use((req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic');
      return res.status(401).send('Authentication required');
    }

    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const [, password] = decoded.split(':');

    if (password === process.env.APP_PASSWORD) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Wrong password');
  });

  // ⚠️ WICHTIG: Express global verfügbar machen
  global.__BASIC_AUTH_APP__ = app;
}

// 2. Produktionsserver laden
try {
  require('./dist/server.js');
} catch (error) {
  // 3. Fallback-Server (unverändert)
  const express = require('express');
  const path = require('path');
  const app = global.__BASIC_AUTH_APP__ || express();


  // --- Basic Auth Middleware (global, before all routes/static) ---
  const APP_PASSWORD = process.env.APP_PASSWORD;
  app.use((req, res, next) => {
    if (!APP_PASSWORD) return next();
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Hottakes"');
      return res.status(401).send('Passwort benötigt');
    }
    const b64 = auth.split(' ')[1];
    let userpass = Buffer.from(b64, 'base64').toString('utf8');
    const idx = userpass.indexOf(':');
    const pass = idx >= 0 ? userpass.slice(idx + 1) : '';
    if (pass !== APP_PASSWORD) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Hottakes"');
      return res.status(401).send('Falsches Passwort');
    }
    next();
  });

  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });

  const PORT = Number.parseInt(process.env.PORT || '3000', 10);
  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Fallback-Server läuft auf http://${HOST}:${PORT}`);
  });
}
