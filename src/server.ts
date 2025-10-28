import 'dotenv/config';
import app from './app';

const PORT = Number(process.env.PORT || '3000');
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Hottakes API listening on http://${HOST}:${PORT}`);
});
