import type { Prisma as CenterPrisma } from '@prisma/.prisma/center-client/index.js';

import { normalizeTenantIdentityProfile } from '~/utils/customer-identity';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import {
  ensureDefaultOrganizationRole,
  ORGANIZATION_MEMBER_ROLE_OWNER,
  OrganizationLifecycleError,
} from '~/utils/organization-role-policy';
import { resolveTenantUserForCenterUser } from '~/utils/user-customer-mapping';

type CenterDb = CenterPrisma.TransactionClient | typeof systemDbClient;

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

function normalizePositiveInteger(value: unknown, label: string) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new OrganizationLifecycleError(`${label} 不合法`, 400);
  }
  return normalized;
}

function normalizeSourceCustomerId(value: unknown) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new OrganizationLifecycleError('组织来源租户不合法', 400);
  }
  return customerId;
}

function buildOrganizationName(input: {
  city?: null | string;
  companyShortName?: null | string;
  fallbackName: string;
}) {
  return (
    String(input.companyShortName || '').trim() ||
    String(input.fallbackName || '').trim() ||
    String(input.city || '').trim() ||
    '未命名组织'
  ).slice(0, 100);
}

function hasOrganizationIdentityField(value: unknown) {
  return Boolean(String(value ?? '').trim());
}

async function getCustomerDbName(sourceCustomerId: string) {
  if (sourceCustomerId === 'public') {
    return null;
  }

  const customer = await systemDbClient.customer.findUnique({
    select: {
      dbName: true,
      status: true,
    },
    where: { customerId: sourceCustomerId },
  });
  if (!customer || Number(customer.status ?? 1) === 0) {
    throw new OrganizationLifecycleError('组织来源租户不可用', 409);
  }

  return customer.dbName ? String(customer.dbName) : null;
}

async function resolveSourceUserForOrganizationOwner(params: {
  centerUserId: number;
  sourceCustomerId: string;
}) {
  const centerUser = await systemDbClient.user.findUnique({
    select: {
      id: true,
      realName: true,
      status: true,
      username: true,
    },
    where: { id: params.centerUserId },
  });
  if (!centerUser || Number(centerUser.status ?? 1) !== 1) {
    throw new OrganizationLifecycleError('组织 owner 中心账号不存在或已停用');
  }

  const dbName = await getCustomerDbName(params.sourceCustomerId);
  const sourceUser = await prismaScopeStorage.run(
    { customerId: params.sourceCustomerId, dbName },
    () =>
      resolveTenantUserForCenterUser({
        centerUserId: Number(centerUser.id),
        customerId: params.sourceCustomerId,
        dbName,
        prisma: prismaClient,
        username: String(centerUser.username),
      }),
  );
  if (!sourceUser) {
    throw new OrganizationLifecycleError('组织 owner 缺少可绑定的来源库账号');
  }

  return {
    centerUser,
    dbName,
    sourceUserId: Number(sourceUser.customerUserId),
  };
}

async function listActiveSourceOrganizationMembershipsForCenterUser(params: {
  centerDb: CenterDb;
  centerUserId: number;
  sourceCustomerId: string;
}) {
  const memberships = await params.centerDb.organizationMember.findMany({
    orderBy: { id: 'asc' },
    select: {
      memberRole: true,
      organizationId: true,
      sourceUserId: true,
    },
    where: {
      centerUserId: params.centerUserId,
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });
  const organizationIds = [
    ...new Set(memberships.map((item) => Number(item.organizationId))),
  ].filter((id) => Number.isInteger(id) && id > 0);
  if (organizationIds.length === 0) {
    return [];
  }

  const organizations = await params.centerDb.organization.findMany({
    select: {
      city: true,
      companyShortName: true,
      createdByCenterUserId: true,
      id: true,
      legacy: true,
      name: true,
      sourceCustomerId: true,
      status: true,
    },
    where: {
      id: { in: organizationIds },
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });
  const organizationMap = new Map(
    organizations.map((organization) => [
      Number(organization.id),
      organization,
    ]),
  );

  return memberships
    .map((membership) => {
      const organization = organizationMap.get(
        Number(membership.organizationId),
      );
      if (!organization) {
        return null;
      }

      return {
        memberRole: String(membership.memberRole || ''),
        organization: normalizeOrganizationOverviewRow({
          ...organization,
          targetCustomerId: null,
          targetDbName: null,
        }),
        sourceUserId:
          membership.sourceUserId === null
            ? null
            : Number(membership.sourceUserId),
        status: 'active',
      };
    })
    .filter(Boolean);
}

async function lockCenterUserForOrganizationProvisioning(
  centerDb: CenterDb,
  centerUserId: number,
) {
  await centerDb.$queryRawUnsafe(
    'SELECT id FROM `user` WHERE id = ? FOR UPDATE',
    centerUserId,
  );
}

async function ensureSourceOrganizationDefaultRole(params: {
  dbName: null | string;
  organizationId: number;
  sourceCustomerId: string;
}) {
  return prismaScopeStorage.run(
    {
      customerId: params.sourceCustomerId,
      dbName: params.dbName,
    },
    () =>
      ensureDefaultOrganizationRole({
        organizationId: params.organizationId,
        prisma: prismaClient,
      }),
  );
}

async function completeExistingSourceOrganizationIdentity(params: {
  centerDb: CenterDb;
  organization: OrganizationOverview;
  tenantIdentity?: {
    city?: unknown;
    companyShortName?: unknown;
  };
}) {
  const hasCity = hasOrganizationIdentityField(params.organization.city);
  const hasCompanyShortName = hasOrganizationIdentityField(
    params.organization.companyShortName,
  );
  if (hasCity && hasCompanyShortName) {
    return params.organization;
  }

  const profile = normalizeTenantIdentityProfile({
    city: hasCity ? params.organization.city : params.tenantIdentity?.city,
    companyShortName: hasCompanyShortName
      ? params.organization.companyShortName
      : params.tenantIdentity?.companyShortName,
  });
  const data: CenterPrisma.OrganizationUpdateInput = {};
  if (!hasCity) {
    data.city = profile.city;
  }
  if (!hasCompanyShortName) {
    data.companyShortName = profile.companyShortName;
  }

  const updated = await params.centerDb.organization.update({
    data,
    where: { id: params.organization.id },
  });
  return normalizeOrganizationOverviewRow({
    ...updated,
    targetCustomerId: params.organization.targetCustomerId,
    targetDbName: params.organization.targetDbName,
  });
}

async function resolveOrCreateSourceOrganizationAnchorInTransaction(params: {
  centerDb: CenterDb;
  centerUser: {
    realName: string;
    username: string;
  };
  centerUserId: number;
  sourceCustomerId: string;
  sourceUserId: number;
  tenantIdentity?: {
    city?: unknown;
    companyShortName?: unknown;
  };
}) {
  await lockCenterUserForOrganizationProvisioning(
    params.centerDb,
    params.centerUserId,
  );

  const memberships =
    await listActiveSourceOrganizationMembershipsForCenterUser({
      centerDb: params.centerDb,
      centerUserId: params.centerUserId,
      sourceCustomerId: params.sourceCustomerId,
    });
  if (memberships.length > 1) {
    throw new OrganizationLifecycleError(
      '当前账号绑定多个 active 组织，请先选择要开通的组织',
      400,
    );
  }

  const existingMembership = memberships[0];
  if (existingMembership) {
    if (existingMembership.memberRole !== ORGANIZATION_MEMBER_ROLE_OWNER) {
      throw new OrganizationLifecycleError(
        '只有组织 owner 可以开通专属空间',
        403,
      );
    }
    const organization = await completeExistingSourceOrganizationIdentity({
      centerDb: params.centerDb,
      organization: existingMembership.organization,
      tenantIdentity: params.tenantIdentity,
    });
    if (!existingMembership.sourceUserId) {
      await params.centerDb.organizationMember.update({
        data: { sourceUserId: params.sourceUserId },
        where: {
          organizationId_centerUserId: {
            centerUserId: params.centerUserId,
            organizationId: existingMembership.organization.id,
          },
        },
      });
      return {
        ...existingMembership,
        organization,
        sourceUserId: params.sourceUserId,
      };
    }
    return {
      ...existingMembership,
      organization,
    };
  }

  const profile = normalizeTenantIdentityProfile(params.tenantIdentity || {});
  const organization = await params.centerDb.organization.create({
    data: {
      city: profile.city,
      companyShortName: profile.companyShortName,
      createdByCenterUserId: params.centerUserId,
      legacy: false,
      name: buildOrganizationName({
        city: profile.city,
        companyShortName: profile.companyShortName,
        fallbackName:
          params.centerUser.realName || params.centerUser.username || '',
      }),
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });
  await params.centerDb.organizationMember.create({
    data: {
      centerUserId: params.centerUserId,
      joinedAt: new Date(),
      memberRole: ORGANIZATION_MEMBER_ROLE_OWNER,
      organizationId: Number(organization.id),
      sourceCustomerId: params.sourceCustomerId,
      sourceUserId: params.sourceUserId,
      status: 'active',
    },
  });

  return {
    memberRole: ORGANIZATION_MEMBER_ROLE_OWNER,
    organization: normalizeOrganizationOverviewRow({
      ...organization,
      targetCustomerId: null,
      targetDbName: null,
    }),
    sourceUserId: params.sourceUserId,
    status: 'active',
  };
}

export async function ensureSingleOwnerSourceOrganizationForCenterUser(params: {
  centerUserId: number;
  sourceCustomerId: string;
  tenantIdentity?: {
    city?: unknown;
    companyShortName?: unknown;
  };
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const sourceCustomerId = normalizeSourceCustomerId(params.sourceCustomerId);
  const sourceUser = await resolveSourceUserForOrganizationOwner({
    centerUserId,
    sourceCustomerId,
  });

  const membership = await systemDbClient.$transaction((tx) =>
    resolveOrCreateSourceOrganizationAnchorInTransaction({
      centerDb: tx,
      centerUser: {
        realName: sourceUser.centerUser.realName,
        username: sourceUser.centerUser.username,
      },
      centerUserId,
      sourceCustomerId,
      sourceUserId: sourceUser.sourceUserId,
      tenantIdentity: params.tenantIdentity,
    }),
  );

  await ensureSourceOrganizationDefaultRole({
    dbName: sourceUser.dbName,
    organizationId: membership.organization.id,
    sourceCustomerId,
  });

  return membership;
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

export async function resolveActiveOrganizationMembershipForTargetCustomer(params: {
  centerUserId: number;
  targetCustomerId: string;
}) {
  const centerUserId = Number(params.centerUserId);
  const targetCustomerId = String(params.targetCustomerId || '').trim();
  if (
    !Number.isInteger(centerUserId) ||
    centerUserId <= 0 ||
    !targetCustomerId
  ) {
    return null;
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
      FROM organization_tenant_mapping m
      INNER JOIN organization o ON o.id = m.organization_id
      INNER JOIN organization_member member ON member.organization_id = o.id
      WHERE m.target_customer_id = ?
        AND m.status = 'active'
        AND o.status = 'active'
        AND member.center_user_id = ?
        AND member.status = 'active'
      LIMIT 1
    `,
    targetCustomerId,
    centerUserId,
  );
  const row = rows[0];
  return row
    ? {
        memberRole: row.memberRole,
        organization: normalizeOrganizationOverviewRow(row),
        sourceUserId:
          row.sourceUserId === null ? null : Number(row.sourceUserId),
        status: row.memberStatus,
      }
    : null;
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

export async function getSingleActiveSourceOrganizationStateForCenterUser(params: {
  centerUserId: number;
  sourceCustomerId: string;
}) {
  const memberships = await listActiveOrganizationMembershipsByCenterUserId(
    params.centerUserId,
  );
  const matched = memberships.filter(
    (item) => item.organization.sourceCustomerId === params.sourceCustomerId,
  );

  return {
    membership: matched.length === 1 ? matched[0] : null,
    total: matched.length,
  };
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
