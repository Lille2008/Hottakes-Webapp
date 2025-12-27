try {
  require('./dist/server.js');
} catch (error) {
  const express = require('express');
  const path = require('path');
  const app = express();
// Einfache Basic Auth Middleware
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Authentication required');
  }

  const base64 = auth.slice(6);
  const decoded = Buffer.from(base64, 'base64').toString();
  const [, password] = decoded.split(':');

  if (password === process.env.APP_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic');
  return res.status(401).send('Wrong password');
}

if (process.env.APP_PASSWORD) {
  app.use(basicAuth);
} // Schutz durch Basic Auth vor Laden der Website nur wenn APP_PASSWORD gesetzt ist (kann ich ausschalten, sobald ich öffentlich werden möchte)
  // Ende Basic Auth Middleware
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
