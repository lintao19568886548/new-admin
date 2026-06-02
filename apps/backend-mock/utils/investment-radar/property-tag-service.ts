import { prismaClient } from '~/utils/db';

import { assertInvestmentRadarTableReady } from './schema-guard';

export interface PropertyTagUpdateResult {
  factoryId: number;
  factoryName: string;
  tags: string[];
  updateTime: string;
}

function normalizeTags(input: unknown): string[] {
  let rawItems: unknown[] = [];
  if (Array.isArray(input)) {
    rawItems = input;
  } else if (typeof input === 'string') {
    rawItems = input.split(/[,，、\n]/);
  }
  const tags = rawItems
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 50));
  return [...new Set(tags)].slice(0, 30);
}

function compactTagText(tags: string[]) {
  return tags.slice(0, 3).join('、').slice(0, 50) || null;
}

async function tableExists(tableName: string) {
  const rows = await prismaClient.$queryRawUnsafe<Array<{ total: any }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    tableName,
  );
  return Number(rows[0]?.total || 0) > 0;
}

export async function ensureInvestmentPropertyTagTable() {
  await assertInvestmentRadarTableReady('investment_property_tag');
}

export async function getPropertyTagsByFactoryIds(factoryIds: number[]) {
  await ensureInvestmentPropertyTagTable();
  const normalizedIds = [...new Set(factoryIds.filter((id) => id > 0))];
  if (normalizedIds.length === 0) {
    return new Map<number, string[]>();
  }

  const rows = await prismaClient.$queryRawUnsafe<
    Array<{ factoryId: any; tagsJson: null | string }>
  >(
    `
      SELECT factory_id AS factoryId, tags_json AS tagsJson
      FROM investment_property_tag
      WHERE factory_id IN (${normalizedIds.map(() => '?').join(', ')})
    `,
    ...normalizedIds,
  );

  const result = new Map<number, string[]>();
  for (const row of rows) {
    try {
      const parsed = row.tagsJson ? JSON.parse(row.tagsJson) : [];
      result.set(Number(row.factoryId), normalizeTags(parsed));
    } catch {
      result.set(Number(row.factoryId), []);
    }
  }
  return result;
}

export async function updatePropertyTags(params: {
  actorId?: null | number;
  factoryId: number;
  tags: unknown;
}): Promise<null | PropertyTagUpdateResult> {
  await ensureInvestmentPropertyTagTable();
  const factory = await prismaClient.factory.findFirst({
    select: {
      factoryId: true,
      factoryName: true,
    },
    where: {
      factoryId: params.factoryId,
      isDeleted: false,
    },
  });
  if (!factory) {
    return null;
  }

  const tags = normalizeTags(params.tags);
  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO investment_property_tag (
        factory_id, tags_json, operator_user_id, create_time, update_time
      )
      VALUES (?, ?, ?, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        tags_json = VALUES(tags_json),
        operator_user_id = VALUES(operator_user_id),
        update_time = NOW(3)
    `,
    factory.factoryId,
    JSON.stringify(tags),
    params.actorId || null,
  );

  if (await tableExists('property_match_result')) {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE property_match_result
        SET tag = ?, update_time = NOW(3)
        WHERE factory_id = ?
      `,
      compactTagText(tags),
      factory.factoryId,
    );
  }

  return {
    factoryId: factory.factoryId,
    factoryName: factory.factoryName,
    tags,
    updateTime: new Date().toISOString(),
  };
}
