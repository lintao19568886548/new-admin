import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config();
dotenv.config({ path: '.env.dev' });

const target = process.env.PRISMA_TARGET;
const isNotices = target === 'notices';

export default defineConfig({
  schema: isNotices ? 'prisma/notices/schema.prisma' : 'prisma/schema',
  datasource: {
    url: env(isNotices ? 'NOTICES_DATABASE_URL' : 'DATABASE_URL'),
  },
});
