import { systemDbClient } from '~/utils/db';

export type OrganizationOverview = {
  city: null | string;
  companyShortName: null | string;
  createdByCenterUserId: null | number;
  id: number;
  legacy: boolean;
  name: string;
  sourceCustomerId: string;
  status: string;
  targetCustomerId: null | string;
  targetDbName: null | string;
};

export type CurrentOrganizationMembership = {
  memberRole: string;
  organization: OrganizationOverview;
  sourceUserId: null | number;
  status: string;
};

type OrganizationOverviewRow = {
  city: null | string;
  companyShortName: null | string;
  createdByCenterUserId: null | number;
  id: number;
  legacy: boolean | number;
  name: string;
  sourceCustomerId: string;
  status: string;
  targetCustomerId: null | string;
  targetDbName: null | string;
};

type CurrentOrganizationMembershipRow = OrganizationOverviewRow & {
  memberRole: string;
  memberStatus: string;
  sourceUserId: null | number;
};

function normalizeOrganizationOverviewRow(
  row: OrganizationOverviewRow,
): OrganizationOverview {
  return {
    ...row,
    createdByCenterUserId:
      row.createdByCenterUserId === null
        ? null
        : Number(row.createdByCenterUserId),
    id: Number(row.id),
    legacy: row.legacy === true || row.legacy === 1,
  };
}

export async function getOrganizationByTargetCustomerId(
  targetCustomerId: string,
) {
  const customerId = String(targetCustomerId || '').trim();
  if (!customerId) {
    return null;
  }

  const rows = await systemDbClient.$queryRawUnsafe<OrganizationOverviewRow[]>(
    `
      SELECT
        o.id,
        o.name,
        o.city,
        o.company_short_name AS companyShortName,
        o.source_customer_id AS sourceCustomerId,
        o.status,
        o.created_by_center_user_id AS createdByCenterUserId,
        o.legacy,
        m.target_customer_id AS targetCustomerId,
        m.target_db_name AS targetDbName
      FROM organization_tenant_mapping m
      INNER JOIN organization o ON o.id = m.organization_id
      WHERE m.target_customer_id = ?
      LIMIT 1
    `,
    customerId,
  );

  return rows[0] ? normalizeOrganizationOverviewRow(rows[0]) : null;
}

export async function listOrganizationsByCenterUserId(centerUserId: number) {
  const userId = Number(centerUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
  }

  const rows = await systemDbClient.$queryRawUnsafe<OrganizationOverviewRow[]>(
    `
      SELECT
        o.id,
        o.name,
        o.city,
        o.company_short_name AS companyShortName,
        o.source_customer_id AS sourceCustomerId,
        o.status,
        o.created_by_center_user_id AS createdByCenterUserId,
        o.legacy,
        m.target_customer_id AS targetCustomerId,
        m.target_db_name AS targetDbName
      FROM organization_member member
      INNER JOIN organization o ON o.id = member.organization_id
      LEFT JOIN organization_tenant_mapping m ON m.organization_id = o.id
      WHERE member.center_user_id = ?
      ORDER BY o.id ASC
    `,
    userId,
  );

  return rows.map((row) => normalizeOrganizationOverviewRow(row));
}

export async function listActiveOrganizationMembershipsByCenterUserId(
  centerUserId: number,
) {
  const userId = Number(centerUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
  }

  const rows = await systemDbClient.$queryRawUnsafe<
    CurrentOrganizationMembershipRow[]
  >(
    `
        SELECT
          o.id,
          o.name,
          o.city,
          o.company_short_name AS companyShortName,
          o.source_customer_id AS sourceCustomerId,
          o.status,
          o.created_by_center_user_id AS createdByCenterUserId,
          o.legacy,
          m.target_customer_id AS targetCustomerId,
          m.target_db_name AS targetDbName,
          member.member_role AS memberRole,
          member.status AS memberStatus,
          member.source_user_id AS sourceUserId
        FROM organization_member member
        INNER JOIN organization o ON o.id = member.organization_id
        LEFT JOIN organization_tenant_mapping m ON m.organization_id = o.id
        WHERE member.center_user_id = ?
          AND member.status = 'active'
          AND o.status = 'active'
        ORDER BY o.id ASC
      `,
    userId,
  );

  return rows.map((row) => ({
    memberRole: row.memberRole,
    organization: normalizeOrganizationOverviewRow(row),
    sourceUserId: row.sourceUserId === null ? null : Number(row.sourceUserId),
    status: row.memberStatus,
  }));
}

export async function resolveSingleActiveSourceOrganizationForCenterUser(params: {
  centerUserId: number;
  sourceCustomerId: string;
}) {
  const memberships = await listActiveOrganizationMembershipsByCenterUserId(
    params.centerUserId,
  );
  const matched = memberships.filter(
    (item) => item.organization.sourceCustomerId === params.sourceCustomerId,
  );

  return matched.length === 1 ? matched[0] : null;
}

export async function resolveSingleActiveOwnedSourceOrganizationForCenterUser(params: {
  centerUserId: number;
  sourceCustomerId: string;
}) {
  const memberships = await listActiveOrganizationMembershipsByCenterUserId(
    params.centerUserId,
  );
  const matched = memberships.filter(
    (item) =>
      item.organization.sourceCustomerId === params.sourceCustomerId &&
      item.memberRole === 'owner',
  );

  return matched.length === 1 ? matched[0] : null;
}
