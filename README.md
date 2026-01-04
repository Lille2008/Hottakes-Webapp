## Zugangspasswort (optional)

Setze die Umgebungsvariable `APP_PASSWORD`, um die Seite per Basic Auth zu schützen. Das Passwort wird beim ersten Aufruf einer beliebigen Seite oder API-Route abgefragt (inkl. `index.html`, `login.html`, `register.html`, direkten Asset-URLs und `/api/...`). Nach erfolgreicher Eingabe wird ein httpOnly-Cookie `hottakes_basic_auth` gesetzt, das die Abfrage für 7 Tage überspringt. In Produktion sollte `NODE_ENV=production` gesetzt sein, damit das Cookie als `secure` markiert wird.

