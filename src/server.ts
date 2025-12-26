import 'dotenv/config';
import app from './app';
import { startReminderScheduler } from './lib/scheduler';

const PORT = Number(process.env.PORT || '3000');
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Hottakes API listening on http://${HOST}:${PORT}`);
});

startReminderScheduler();
