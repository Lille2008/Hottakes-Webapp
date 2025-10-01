const express = require('express');
const path = require('path');
const app = express();

// Statischer Ordner: Render liefert public/ aus
app.use(express.static(path.join(__dirname, 'public')));

// Route für Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Render gibt den Port via env vor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
