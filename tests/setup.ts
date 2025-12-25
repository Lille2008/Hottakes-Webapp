import { execSync } from 'node:child_process';
import path from 'node:path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('hottakes')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const connectionUri = container.getConnectionUri();
  process.env.DATABASE_URL = connectionUri;
  process.env.DIRECT_DATABASE_URL = connectionUri;
  process.env.NODE_ENV = 'test';

  execSync('npx prisma db push --skip-generate', {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: connectionUri,
      DIRECT_DATABASE_URL: connectionUri
    },
    stdio: 'inherit'
  });
});

afterAll(async () => {
  const { default: prisma } = await import('../src/lib/db');
  await prisma.$disconnect();

  if (container) {
    await container.stop();
  }
});
