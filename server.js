try {
  require('./dist/server.js');
} catch (error) {
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
