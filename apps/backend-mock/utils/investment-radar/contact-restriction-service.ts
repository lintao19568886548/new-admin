import { prismaClient } from '~/utils/db';

interface ContactRestrictionInput {
  enterpriseId?: null | number;
  leadId?: null | number;
  phoneNumber?: null | string;
  reason?: null | string;
  restrictionType: string;
}

export interface ContactRestrictionCheckResult {
  canContact: boolean;
  reason: string;
}

export async function ensureContactRestrictionTable() {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS contact_restriction (
      restriction_id BIGINT NOT NULL AUTO_INCREMENT,
      lead_id BIGINT NULL,
      enterprise_id BIGINT NULL,
      phone_number VARCHAR(50) NULL,
      restriction_type VARCHAR(50) NOT NULL,
      reason VARCHAR(255) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (restriction_id),
      UNIQUE KEY uk_contact_restriction_lead_type (lead_id, restriction_type),
      INDEX idx_contact_restriction_phone_status (phone_number, status),
      INDEX idx_contact_restriction_enterprise_status (enterprise_id, status),
      INDEX idx_contact_restriction_status (status)
    )
  `);
}

export async function checkContactRestriction(params: {
  enterpriseId?: null | number;
  leadId?: null | number;
  phoneNumber?: null | string;
}): Promise<ContactRestrictionCheckResult> {
  await ensureContactRestrictionTable();

  const phoneNumber = String(params.phoneNumber || '').trim();
  const rows = await prismaClient.$queryRawUnsafe<any[]>(
    `
      SELECT restriction_type AS restrictionType, reason
      FROM contact_restriction
      WHERE status = 'ACTIVE'
        AND (
          (lead_id IS NOT NULL AND lead_id = ?)
          OR (enterprise_id IS NOT NULL AND enterprise_id = ?)
          OR (phone_number IS NOT NULL AND phone_number <> '' AND phone_number = ?)
        )
      ORDER BY
        CASE restriction_type
          WHEN 'UNSUBSCRIBED' THEN 0
          WHEN 'BLACKLIST' THEN 1
          WHEN 'NEGATIVE_REPLY' THEN 2
          ELSE 3
        END,
        restriction_id DESC
      LIMIT 1
    `,
    params.leadId || null,
    params.enterpriseId || null,
    phoneNumber || null,
  );

  const restriction = rows[0];
  if (!restriction) {
    return {
      canContact: true,
      reason: '',
    };
  }

  return {
    canContact: false,
    reason:
      restriction.reason ||
      mapRestrictionReason(String(restriction.restrictionType || '')),
  };
}

export async function upsertContactRestriction(input: ContactRestrictionInput) {
  await ensureContactRestrictionTable();

  await prismaClient.$executeRawUnsafe(
    `
      INSERT INTO contact_restriction
        (lead_id, enterprise_id, phone_number, restriction_type, reason, status, create_time, update_time)
      VALUES
        (?, ?, ?, ?, ?, 'ACTIVE', NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        enterprise_id = COALESCE(VALUES(enterprise_id), enterprise_id),
        phone_number = COALESCE(VALUES(phone_number), phone_number),
        reason = VALUES(reason),
        status = 'ACTIVE',
        update_time = NOW(3)
    `,
    input.leadId || null,
    input.enterpriseId || null,
    String(input.phoneNumber || '').trim() || null,
    input.restrictionType,
    input.reason || mapRestrictionReason(input.restrictionType),
  );
}

function mapRestrictionReason(restrictionType: string) {
  const reasonMap: Record<string, string> = {
    BLACKLIST: '该联系人已加入触达限制',
    NEGATIVE_REPLY: '客户已明确表示暂无需求',
    UNSUBSCRIBED: '客户已退订或拒绝继续触达',
  };
  return reasonMap[restrictionType] || '当前联系人不建议触达';
}
