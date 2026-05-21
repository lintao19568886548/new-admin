import { prismaClient } from '~/utils/db';

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

export async function ensureFollowRecordTable() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS investment_follow_record (
      record_id BIGINT NOT NULL AUTO_INCREMENT,
      lead_id BIGINT NOT NULL,
      follow_type VARCHAR(30) NOT NULL DEFAULT 'PHONE',
      follow_result VARCHAR(30) NOT NULL DEFAULT 'CONTACTED',
      content TEXT NOT NULL,
      next_action VARCHAR(255) NULL,
      next_follow_time DATETIME(3) NULL,
      operator_user_id BIGINT NULL,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (record_id),
      INDEX idx_investment_follow_record_lead_time (lead_id, create_time),
      INDEX idx_investment_follow_record_result (follow_result)
    )
  `);

  await ensureColumn(
    'investment_follow_record',
    'update_time',
    'update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)',
  );
}

export async function ensureVisitRecordTable() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS investment_visit_record (
      visit_id BIGINT NOT NULL AUTO_INCREMENT,
      lead_id BIGINT NOT NULL,
      factory_floor_id BIGINT NULL,
      scheduled_time DATETIME(3) NOT NULL,
      actual_time DATETIME(3) NULL,
      visitor_name VARCHAR(100) NULL,
      visitor_phone VARCHAR(50) NULL,
      visit_status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
      feedback TEXT NULL,
      operator_user_id BIGINT NULL,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (visit_id),
      INDEX idx_investment_visit_record_lead_time (lead_id, scheduled_time),
      INDEX idx_investment_visit_record_status (visit_status)
    )
  `);

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
}
