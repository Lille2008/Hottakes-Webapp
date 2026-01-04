## Zugangspasswort (optional)

Setze die Umgebungsvariable `APP_PASSWORD`, um die Seite per Basic Auth zu schützen. Das Passwort wird beim ersten Aufruf einer beliebigen Seite abgefragt (inkl. `index.html`, `login.html`, `register.html` oder direkten Asset-URLs), und bei Erfolg wird ein httpOnly-Cookie `hottakes_basic_auth` gesetzt, das die Abfrage für 7 Tage überspringt. API-Routen unter `/api` bleiben unverändert erreichbar. In Produktion sollte `NODE_ENV=production` gesetzt sein, damit das Cookie als `secure` markiert wird.

