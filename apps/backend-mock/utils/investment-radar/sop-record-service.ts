import { prismaClient } from '~/utils/db';

import { assertInvestmentRadarTableReady } from './schema-guard';

async function ensureColumn(
  tableName: string,
  columnName: string,
  ddl: string,
) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ count: bigint }>>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    tableName,
    columnName,
  );

  if (Number(rows[0]?.count || 0) === 0) {
    await prismaClient.$executeRawUnsafe(
      `ALTER TABLE ${tableName} ADD COLUMN ${ddl}`,
    );
  }
}

async function ensureColumnHasDefault(
  tableName: string,
  columnName: string,
  modifyDdl: string,
) {
  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ COLUMN_DEFAULT: null | string; IS_NULLABLE: string }>
  >(
    `
      SELECT COLUMN_DEFAULT, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    tableName,
    columnName,
  );
  const col = rows[0];
  if (col && col.IS_NULLABLE === 'NO' && col.COLUMN_DEFAULT === null) {
    await prismaClient.$executeRawUnsafe(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${modifyDdl}`,
    );
  }
}

export async function ensureFollowRecordTable() {
  await assertInvestmentRadarTableReady('investment_follow_record');

  await ensureColumn(
    'investment_follow_record',
    'update_time',
    'update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
  );
  await ensureColumnHasDefault(
    'investment_follow_record',
    'update_time',
    'update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
  );
}

export async function ensureVisitRecordTable() {
  await assertInvestmentRadarTableReady('investment_visit_record');

  await ensureColumn(
    'investment_visit_record',
    'actual_time',
    'actual_time DATETIME(3) NULL',
  );
  await ensureColumn(
    'investment_visit_record',
    'visit_status',
    "visit_status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'",
  );
  await ensureColumn(
    'investment_visit_record',
    'feedback',
    'feedback TEXT NULL',
  );
  await ensureColumn(
    'investment_visit_record',
    'update_time',
    'update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
  );
  await ensureColumnHasDefault(
    'investment_visit_record',
    'update_time',
    'update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
  );
}
