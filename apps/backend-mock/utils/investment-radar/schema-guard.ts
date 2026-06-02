import { prismaClient } from '~/utils/db';

const identifierPattern = /^[a-z]\w*$/i;

function assertSafeTableName(tableName: string) {
  if (!identifierPattern.test(tableName)) {
    throw new Error(`Invalid investment radar table name: ${tableName}`);
  }
}

export async function assertInvestmentRadarTableReady(tableName: string) {
  assertSafeTableName(tableName);

  try {
    await prismaClient.$queryRawUnsafe(
      `SELECT 1 FROM \`${tableName}\` LIMIT 0`,
    );
  } catch (error) {
    const message = String((error as Error)?.message || error || '');
    throw new Error(
      `Investment radar table "${tableName}" is missing or not accessible. Run Prisma db push before serving this feature. Original error: ${message}`,
    );
  }
}

export async function assertInvestmentRadarTablesReady(tableNames: string[]) {
  for (const tableName of tableNames) {
    await assertInvestmentRadarTableReady(tableName);
  }
}
