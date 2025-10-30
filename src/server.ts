// Einstiegspunkt des Servers: lädt Umgebungsvariablen und startet die Express-App.
// Trennung von App (reines Express) und Server (Listen/Ports) erleichtert Tests.
import 'dotenv/config';
import app from './app';

// Konfiguration des Netzwerk-Interfaces
const PORT = Number(process.env.PORT || '3000');
const HOST = '0.0.0.0';

// App starten und eine kurze Bestätigung ausgeben
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Hottakes API listening on http://${HOST}:${PORT}`);
});
