// Build-Hilfsskript: Kopiert den Inhalt von /public nach /dist/public,
// damit die statischen Assets zusammen mit dem kompilierten Backend ausgeliefert werden können.
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'public');
const destination = path.resolve(__dirname, '..', 'dist', 'public');

// Rekursiver Kopierhelfer für Verzeichnisse
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Kein public/-Ordner vorhanden? Dann gibt es nichts zu kopieren
if (!fs.existsSync(source)) {
  console.warn(`Skipping static copy: ${source} does not exist.`);
  process.exit(0);
}

fs.rmSync(destination, { recursive: true, force: true });
copyDirectory(source, destination);
