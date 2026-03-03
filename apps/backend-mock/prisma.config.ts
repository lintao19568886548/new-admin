import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ path: '.env' });

const target = process.env.PRISMA_TARGET;
const isNotices = target === 'notices';
const isCenter = target === 'center';

const schemaPath = (() => {
  if (isNotices) return 'prisma/notices/schema.prisma';
  if (isCenter) return 'prisma/center';
  return 'prisma/schema';
})();

const datasourceUrlEnvKey = (() => {
  if (isNotices) return 'NOTICES_DATABASE_URL';
  if (isCenter)
    return process.env.CENTER_DATABASE_URL
      ? 'CENTER_DATABASE_URL'
      : 'DATABASE_URL';
  return 'DATABASE_URL';
})();

export default defineConfig({
  schema: schemaPath,
  datasource: {
    url: env(datasourceUrlEnvKey),
  },
});
