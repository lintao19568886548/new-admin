import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function createConnectionConfig(rawUrl) {
  const url = new URL(stripWrappingQuotes(rawUrl));
  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function queryOne(connection, sql, params = []) {
  const rows = await connection.query(sql, params);
  return rows[0] || {};
}

async function main() {
  const databaseUrl =
    stripWrappingQuotes(process.env.DATABASE_URL) ||
    stripWrappingQuotes(process.env.PUBLIC_DATABASE_URL);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置');
  }

  const connection = await mariadb.createConnection(
    createConnectionConfig(databaseUrl),
  );
  const marker = `事务回滚测试-${Date.now()}`;
  let billId = null;
  let financeId = null;

  try {
    const park = await queryOne(
      connection,
      'SELECT park_id AS parkId FROM park WHERE is_deleted = 0 LIMIT 1',
    );
    assert(park.parkId, '没有可用于测试的园区');

    await connection.beginTransaction();

    const financeResult = await connection.query(
      `
        INSERT INTO finance
          (bill_name, bill_category, amount, transaction_type, transaction_time, park_id, remark, is_deleted)
        VALUES
          (?, '账单收入', 1234.56, '收入', NOW(), ?, ?, 0)
      `,
      [marker, park.parkId, marker],
    );
    financeId = Number(financeResult.insertId);

    const billResult = await connection.query(
      `
        INSERT INTO amount_bill
          (
            project_name,
            tenant_name,
            ele_fee,
            water_fee,
            factory_rent,
            management_fee,
            garbage_fee,
            service_fee,
            invoice_tax,
            penalty_fee,
            total_fee,
            receive_amount,
            receipt_time,
            park_id,
            finance_id
          )
        VALUES
          (?, ?, 100, 0, 1000, 40, 20, 50, 30, 0, 1240, 1234.56, NOW(), ?, ?)
      `,
      [marker, marker, park.parkId, financeId],
    );
    billId = Number(billResult.insertId);

    const linked = await queryOne(
      connection,
      `
        SELECT finance_id AS financeId
        FROM amount_bill
        WHERE bill_id = ?
      `,
      [billId],
    );
    assert(Number(linked.financeId) === financeId, '账单没有正确关联财务流水', {
      billId,
      financeId,
    });

    await connection.query(
      'UPDATE finance SET is_deleted = 1 WHERE finance_id = ?',
      [financeId],
    );
    await connection.query(
      `
        UPDATE amount_bill
        SET finance_id = NULL, receive_amount = 0, receipt_time = NULL
        WHERE bill_id = ?
      `,
      [billId],
    );

    const afterCancel = await queryOne(
      connection,
      'SELECT is_deleted AS isDeleted FROM finance WHERE finance_id = ?',
      [financeId],
    );
    assert(Number(afterCancel.isDeleted) === 1, '取消收款后财务没有软删除');

    await connection.query(
      `
        UPDATE finance
        SET amount = 2234.56, is_deleted = 0, transaction_time = NOW()
        WHERE finance_id = ?
      `,
      [financeId],
    );
    await connection.query(
      `
        UPDATE amount_bill
        SET finance_id = ?, receive_amount = 2234.56, receipt_time = NOW()
        WHERE bill_id = ?
      `,
      [financeId, billId],
    );

    const activeCount = await queryOne(
      connection,
      `
        SELECT COUNT(*) AS count
        FROM finance
        WHERE finance_id = ? AND is_deleted = 0
      `,
      [financeId],
    );
    assert(Number(activeCount.count) === 1, '恢复收款后财务没有恢复为有效');

    await connection.query('DELETE FROM amount_bill WHERE bill_id = ?', [
      billId,
    ]);
    await connection.query(
      'UPDATE finance SET is_deleted = 1 WHERE finance_id = ?',
      [financeId],
    );

    const afterBillDelete = await queryOne(
      connection,
      'SELECT is_deleted AS isDeleted FROM finance WHERE finance_id = ?',
      [financeId],
    );
    assert(Number(afterBillDelete.isDeleted) === 1, '删除账单后财务没有软删除');

    await connection.rollback();

    const leakedBill = await queryOne(
      connection,
      'SELECT COUNT(*) AS count FROM amount_bill WHERE bill_id = ?',
      [billId],
    );
    const leakedFinance = await queryOne(
      connection,
      'SELECT COUNT(*) AS count FROM finance WHERE finance_id = ?',
      [financeId],
    );
    assert(Number(leakedBill.count) === 0, '事务回滚失败：临时账单仍然存在');
    assert(Number(leakedFinance.count) === 0, '事务回滚失败：临时财务仍然存在');

    console.log(
      JSON.stringify(
        {
          ok: true,
          rolledBack: true,
          tested: [
            'create paid bill with finance',
            'cancel receipt soft-deletes finance',
            'restore receipt reactivates same finance',
            'delete bill soft-deletes finance',
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback failure so the original assertion is visible
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
