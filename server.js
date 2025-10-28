try {
  // Produktionsfall: Starte die kompilierte API aus dist/
  // So stellen wir sicher, dass Render die Express-App mit allen Routen ausführt.
  require('./dist/server.js');
} catch (error) {
  // Fallback (z. B. wenn dist noch nicht gebaut wurde): einfacher statischer Server
  const express = require('express');
  const path = require('path');
  const app = express();

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
