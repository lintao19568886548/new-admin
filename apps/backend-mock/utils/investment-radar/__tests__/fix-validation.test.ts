import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// BigInt serialization: outreach-task mapping logic
// Raw Prisma queries on MySQL BIGINT columns return BigInt values.
// JSON.stringify throws on BigInt, so all numeric IDs must be Number() before return.
// ---------------------------------------------------------------------------

/** Simulates the row shape returned by $queryRawUnsafe for outreach task detail */
function mapOutreachTaskDetail(task: Record<string, any>) {
  return {
    ...task,
    taskId: Number(task.taskId),
    leadId: Number(task.leadId),
    enterpriseId:
      task.enterpriseId === null || task.enterpriseId === undefined
        ? null
        : Number(task.enterpriseId),
    parkId:
      task.parkId === null || task.parkId === undefined
        ? null
        : Number(task.parkId),
    enterpriseName: task.enterpriseName || '-',
    intentArea:
      task.intentArea === null || task.intentArea === undefined
        ? null
        : Number(task.intentArea),
    registerCapital:
      task.registerCapital === null || task.registerCapital === undefined
        ? null
        : Number(task.registerCapital),
    totalScore: Number(task.totalScore || 0),
  };
}

/** Simulates the row shape returned by $queryRawUnsafe for outreach task list */
function mapOutreachTaskListItem(item: Record<string, any>) {
  return {
    ...item,
    taskId: Number(item.taskId),
    leadId: Number(item.leadId),
    enterpriseName: item.enterpriseName || '-',
    totalScore: Number(item.totalScore || 0),
  };
}

describe('bigInt serialization — outreach task detail mapping', () => {
  it('converts BigInt taskId and leadId to Number', () => {
    const raw = {
      taskId: BigInt('123456789012345'),
      leadId: BigInt('987654321098765'),
      enterpriseId: BigInt('111'),
      parkId: BigInt('22'),
      enterpriseName: '测试企业',
      intentArea: BigInt('5000'),
      registerCapital: null,
      totalScore: BigInt('85'),
      status: 'SENT',
    };

    const mapped = mapOutreachTaskDetail(raw);

    expect(typeof mapped.taskId).toBe('number');
    expect(typeof mapped.leadId).toBe('number');
    expect(typeof mapped.enterpriseId).toBe('number');
    expect(typeof mapped.parkId).toBe('number');
    expect(typeof mapped.intentArea).toBe('number');
    expect(typeof mapped.totalScore).toBe('number');
    expect(() => JSON.stringify(mapped)).not.toThrow();
  });

  it('keeps null fields null and does not convert them', () => {
    const raw = {
      taskId: BigInt('1'),
      leadId: BigInt('2'),
      enterpriseId: null,
      parkId: null,
      enterpriseName: null,
      intentArea: null,
      registerCapital: undefined,
      totalScore: null,
      status: 'PENDING',
    };

    const mapped = mapOutreachTaskDetail(raw);

    expect(mapped.enterpriseId).toBeNull();
    expect(mapped.parkId).toBeNull();
    expect(mapped.intentArea).toBeNull();
    expect(mapped.registerCapital).toBeNull();
    expect(mapped.enterpriseName).toBe('-');
    expect(mapped.totalScore).toBe(0);
    expect(() => JSON.stringify(mapped)).not.toThrow();
  });

  it('does not throw when spreading raw BigInt object into JSON', () => {
    // Confirm the raw BigInt object itself would throw before mapping
    const rawBigInt = { taskId: BigInt('1') };
    expect(() => JSON.stringify(rawBigInt)).toThrow();

    // After mapping it should be safe
    const mapped = mapOutreachTaskListItem({
      taskId: BigInt('1'),
      leadId: BigInt('2'),
    });
    expect(() => JSON.stringify(mapped)).not.toThrow();
  });
});

describe('bigInt serialization — outreach task list item mapping', () => {
  it('converts BigInt ids and scores in list rows', () => {
    const rows = [
      {
        taskId: BigInt('100'),
        leadId: BigInt('200'),
        enterpriseName: '企业A',
        totalScore: BigInt('90'),
      },
      {
        taskId: BigInt('101'),
        leadId: BigInt('201'),
        enterpriseName: null,
        totalScore: null,
      },
    ];

    const mapped = rows.map((item) => mapOutreachTaskListItem(item));

    expect(mapped[0].taskId).toBe(100);
    expect(mapped[0].leadId).toBe(200);
    expect(mapped[0].totalScore).toBe(90);
    expect(mapped[1].enterpriseName).toBe('-');
    expect(mapped[1].totalScore).toBe(0);
    expect(() => JSON.stringify(mapped)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// schema-guard: assertSafeTableName (extracted logic)
// Protects against SQL injection via table name parameter.
// ---------------------------------------------------------------------------

describe('schema-guard: safe table name pattern', () => {
  const identifierPattern = /^[a-z]\w*$/i;

  const valid = [
    'investment_lead',
    'investment_radar_operation_audit_log',
    'investment_follow_record',
    'investment_outreach_task',
    'property_match_result',
  ];

  const invalid = [
    '',
    'user; DROP TABLE user',
    '`investment_lead`',
    '1_invalid_start',
    'table name with spaces',
    'table-with-dashes',
    '../etc/passwd',
  ];

  it.each(valid)('accepts valid table name: %s', (name) => {
    expect(identifierPattern.test(name)).toBe(true);
  });

  it.each(invalid)('rejects invalid table name: %s', (name) => {
    expect(identifierPattern.test(name)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ensureColumnHasDefault: guard condition logic
// Only modifies a column when IS_NULLABLE='NO' and COLUMN_DEFAULT=null,
// i.e., Prisma @updatedAt columns that have no default in the DB.
// ---------------------------------------------------------------------------

describe('ensureColumnHasDefault: condition logic', () => {
  type ColumnInfo = { COLUMN_DEFAULT: null | string; IS_NULLABLE: string };

  function shouldModifyColumn(col: ColumnInfo | undefined): boolean {
    return !!col && col.IS_NULLABLE === 'NO' && col.COLUMN_DEFAULT === null;
  }

  it('returns true when column is NOT NULL with no default — needs MODIFY', () => {
    expect(
      shouldModifyColumn({ IS_NULLABLE: 'NO', COLUMN_DEFAULT: null }),
    ).toBe(true);
  });

  it('returns false when column already has a default', () => {
    expect(
      shouldModifyColumn({
        IS_NULLABLE: 'NO',
        COLUMN_DEFAULT: 'CURRENT_TIMESTAMP(3)',
      }),
    ).toBe(false);
  });

  it('returns false when column is nullable', () => {
    expect(
      shouldModifyColumn({ IS_NULLABLE: 'YES', COLUMN_DEFAULT: null }),
    ).toBe(false);
  });

  it('returns false when column does not exist (undefined)', () => {
    expect(shouldModifyColumn(undefined)).toBe(false);
  });
});
