import type { Prisma as CenterPrisma } from '@prisma/.prisma/center-client/index.js';
import type {
  Prisma as CustomerPrisma,
  PrismaClient,
} from '@prisma/.prisma/client/index.js';

import { prismaClient, systemDbClient } from '~/utils/db';

export const ORGANIZATION_DEFAULT_MEMBER_ROLE_NAME = '员工';
export const ORGANIZATION_DEFAULT_MEMBER_ROLE_REMARK =
  '组织默认成员角色；默认不授予菜单或权限码';
export const ORGANIZATION_MEMBER_ROLE_OWNER = 'owner';
export const ORGANIZATION_MEMBER_ROLE_MEMBER = 'member';

export class OrganizationLifecycleError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 409,
  ) {
    super(message);
    this.name = 'OrganizationLifecycleError';
  }
}

type CenterDb = CenterPrisma.TransactionClient | typeof systemDbClient;
type CustomerDb = CustomerPrisma.TransactionClient | PrismaClient;

function normalizePositiveInteger(value: unknown, label: string) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new OrganizationLifecycleError(`${label} 不合法`);
  }
  return normalized;
}

function normalizeCustomerId(value: unknown) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new OrganizationLifecycleError('组织来源租户不合法');
  }
  return customerId;
}

function normalizeMemberRole(value: unknown) {
  return String(value || ORGANIZATION_MEMBER_ROLE_MEMBER).trim();
}

function normalizeRoleIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => Math.floor(id)),
    ),
  ];
}

async function listActiveOrganizationIdsForCustomer(customerId: string) {
  const [sourceOrganizations, targetMappings] = await Promise.all([
    systemDbClient.organization.findMany({
      select: { id: true },
      where: {
        sourceCustomerId: customerId,
        status: 'active',
      },
    }),
    systemDbClient.organizationTenantMapping.findMany({
      select: { organizationId: true },
      where: {
        status: 'active',
        targetCustomerId: customerId,
      },
    }),
  ]);

  return [
    ...new Set([
      ...sourceOrganizations.map((item) => Number(item.id)),
      ...targetMappings.map((item) => Number(item.organizationId)),
    ]),
  ].filter((id) => Number.isInteger(id) && id > 0);
}

async function listActiveSourceOrganizationMemberships(params: {
  centerUserId: number;
  sourceCustomerId: string;
}) {
  return systemDbClient.organizationMember.findMany({
    select: {
      memberRole: true,
      organizationId: true,
      sourceCustomerId: true,
    },
    where: {
      centerUserId: params.centerUserId,
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });
}

async function getOrganizationRoleOrganizationIds(params: {
  prisma?: CustomerDb;
  roleIds: number[];
}) {
  const roleIds = normalizeRoleIds(params.roleIds);
  if (roleIds.length === 0) {
    return new Set<number>();
  }

  const prisma = params.prisma ?? prismaClient;
  const roles = await prisma.role.findMany({
    select: {
      organizationId: true,
      roleId: true,
    },
    where: {
      roleId: { in: roleIds },
      scope: 'organization',
    },
  });

  const organizationIds = new Set<number>();
  for (const role of roles) {
    const organizationId = Number(role.organizationId);
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      throw new OrganizationLifecycleError('组织角色缺少组织归属');
    }
    organizationIds.add(organizationId);
  }
  return organizationIds;
}

async function findSourceUserForOrganizationMember(params: {
  centerDb?: CenterDb;
  centerUserId: number;
  prisma?: CustomerDb;
  sourceCustomerId: string;
  sourceUserId?: null | number;
}) {
  const centerDb = params.centerDb ?? systemDbClient;
  const prisma = params.prisma ?? prismaClient;

  const centerUser = await centerDb.user.findUnique({
    select: {
      id: true,
      status: true,
      username: true,
    },
    where: { id: params.centerUserId },
  });
  if (!centerUser || Number(centerUser.status ?? 1) !== 1) {
    throw new OrganizationLifecycleError('组织成员中心账号不存在或已停用');
  }

  const explicitSourceUserId = params.sourceUserId
    ? Number(params.sourceUserId)
    : 0;
  if (explicitSourceUserId > 0) {
    const sourceUser = await prisma.user.findUnique({
      select: { id: true, status: true, username: true },
      where: { id: explicitSourceUserId },
    });
    if (sourceUser && Number(sourceUser.status ?? 1) === 1) {
      return {
        sourceUserId: Number(sourceUser.id),
        username: String(sourceUser.username || centerUser.username),
      };
    }
  }

  const mapping = await centerDb.userCustomerMapping.findUnique({
    select: { customerUserId: true },
    where: {
      centerUserId_customerId: {
        centerUserId: params.centerUserId,
        customerId: params.sourceCustomerId,
      },
    },
  });
  if (mapping?.customerUserId) {
    const sourceUser = await prisma.user.findUnique({
      select: { id: true, status: true, username: true },
      where: { id: Number(mapping.customerUserId) },
    });
    if (sourceUser && Number(sourceUser.status ?? 1) === 1) {
      return {
        sourceUserId: Number(sourceUser.id),
        username: String(sourceUser.username || centerUser.username),
      };
    }
  }

  const sourceUserByUsername = await prisma.user.findUnique({
    select: { id: true, status: true, username: true },
    where: { username: String(centerUser.username) },
  });
  if (sourceUserByUsername && Number(sourceUserByUsername.status ?? 1) === 1) {
    return {
      sourceUserId: Number(sourceUserByUsername.id),
      username: String(sourceUserByUsername.username || centerUser.username),
    };
  }

  throw new OrganizationLifecycleError('组织成员缺少可绑定的来源库账号');
}

export async function ensureDefaultOrganizationRole(params: {
  organizationId: number;
  prisma?: CustomerDb;
}) {
  const organizationId = normalizePositiveInteger(
    params.organizationId,
    'organizationId',
  );
  const prisma = params.prisma ?? prismaClient;

  const existingRole = await prisma.role.findFirst({
    orderBy: { roleId: 'asc' },
    select: { roleId: true },
    where: {
      name: ORGANIZATION_DEFAULT_MEMBER_ROLE_NAME,
      organizationId,
      scope: 'organization',
    },
  });
  if (existingRole) {
    return { created: false, roleId: Number(existingRole.roleId) };
  }

  const createdRole = await prisma.role.create({
    data: {
      name: ORGANIZATION_DEFAULT_MEMBER_ROLE_NAME,
      organizationId,
      parentId: null,
      remark: ORGANIZATION_DEFAULT_MEMBER_ROLE_REMARK,
      scope: 'organization',
      status: true,
    },
    select: { roleId: true },
  });

  return { created: true, roleId: Number(createdRole.roleId) };
}

export async function ensureOrganizationMemberDefaultRoleBinding(params: {
  centerDb?: CenterDb;
  centerUserId: number;
  memberRole?: string;
  onlyWhenNoOrganizationRole?: boolean;
  organizationId: number;
  prisma?: CustomerDb;
  sourceCustomerId: string;
  sourceUserId?: null | number;
}) {
  const organizationId = normalizePositiveInteger(
    params.organizationId,
    'organizationId',
  );
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const sourceCustomerId = normalizeCustomerId(params.sourceCustomerId);
  const memberRole = normalizeMemberRole(params.memberRole);
  const centerDb = params.centerDb ?? systemDbClient;
  const prisma = params.prisma ?? prismaClient;

  const defaultRole = await ensureDefaultOrganizationRole({
    organizationId,
    prisma,
  });

  if (memberRole === ORGANIZATION_MEMBER_ROLE_OWNER) {
    return {
      ...defaultRole,
      bound: false,
      skipped: 'owner' as const,
      sourceUserId: null,
    };
  }

  const sourceUser = await findSourceUserForOrganizationMember({
    centerDb,
    centerUserId,
    prisma,
    sourceCustomerId,
    sourceUserId: params.sourceUserId,
  });

  if (params.onlyWhenNoOrganizationRole) {
    const existingOrganizationRole = await prisma.userRole.findFirst({
      select: { id: true },
      where: {
        userId: sourceUser.sourceUserId,
        role: {
          is: {
            organizationId,
            scope: 'organization',
          },
        },
      },
    });
    if (existingOrganizationRole) {
      return {
        ...defaultRole,
        bound: false,
        skipped: 'existing_organization_role' as const,
        sourceUserId: sourceUser.sourceUserId,
      };
    }
  }

  const existingDefaultRoleBinding = await prisma.userRole.findFirst({
    select: { id: true },
    where: {
      roleId: defaultRole.roleId,
      userId: sourceUser.sourceUserId,
    },
  });

  if (!existingDefaultRoleBinding) {
    await prisma.userRole.create({
      data: {
        roleId: defaultRole.roleId,
        userId: sourceUser.sourceUserId,
      },
    });
  }

  await centerDb.organizationMember.updateMany({
    data: { sourceUserId: sourceUser.sourceUserId },
    where: {
      centerUserId,
      organizationId,
      sourceCustomerId,
      status: 'active',
    },
  });

  return {
    ...defaultRole,
    bound: !existingDefaultRoleBinding,
    skipped: null,
    sourceUserId: sourceUser.sourceUserId,
  };
}

export async function assertCenterUserCanLeaveSourceOrganizations(params: {
  centerUserId: number;
  sourceCustomerId?: string;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const sourceCustomerId = params.sourceCustomerId
    ? normalizeCustomerId(params.sourceCustomerId)
    : '';

  const ownerMembership = await systemDbClient.organizationMember.findFirst({
    select: {
      organizationId: true,
    },
    where: {
      centerUserId,
      memberRole: ORGANIZATION_MEMBER_ROLE_OWNER,
      ...(sourceCustomerId ? { sourceCustomerId } : {}),
      status: 'active',
    },
  });
  if (ownerMembership) {
    throw new OrganizationLifecycleError(
      '组织 owner 不能被移出组织或停用，请先转移 owner',
    );
  }
}

export async function assertCenterUserCanLeaveCustomerOrganizations(params: {
  centerUserId: number;
  customerId: string;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const customerId = normalizeCustomerId(params.customerId);
  const organizationIds =
    await listActiveOrganizationIdsForCustomer(customerId);
  if (organizationIds.length === 0) {
    return;
  }

  const ownerMembership = await systemDbClient.organizationMember.findFirst({
    select: { organizationId: true },
    where: {
      centerUserId,
      memberRole: ORGANIZATION_MEMBER_ROLE_OWNER,
      organizationId: { in: organizationIds },
      status: 'active',
    },
  });
  if (ownerMembership) {
    throw new OrganizationLifecycleError(
      '组织 owner 不能被移出组织或停用，请先转移 owner',
    );
  }
}

export async function deactivateCenterUserSourceOrganizationMemberships(params: {
  centerUserId: number;
  sourceCustomerId?: string;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const sourceCustomerId = params.sourceCustomerId
    ? normalizeCustomerId(params.sourceCustomerId)
    : '';

  return systemDbClient.organizationMember.updateMany({
    data: { status: 'inactive' },
    where: {
      centerUserId,
      memberRole: { not: ORGANIZATION_MEMBER_ROLE_OWNER },
      ...(sourceCustomerId ? { sourceCustomerId } : {}),
      status: 'active',
    },
  });
}

export async function deactivateCenterUserCustomerOrganizationMemberships(params: {
  centerUserId: number;
  customerId: string;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const customerId = normalizeCustomerId(params.customerId);
  const organizationIds =
    await listActiveOrganizationIdsForCustomer(customerId);
  if (organizationIds.length === 0) {
    return { count: 0, organizationIds: [] };
  }

  const result = await systemDbClient.organizationMember.updateMany({
    data: { status: 'inactive' },
    where: {
      centerUserId,
      memberRole: { not: ORGANIZATION_MEMBER_ROLE_OWNER },
      organizationId: { in: organizationIds },
      status: 'active',
    },
  });
  return { count: result.count, organizationIds };
}

export async function removeOrganizationRolesForUser(params: {
  organizationIds: number[];
  prisma?: CustomerDb;
  userId: number;
}) {
  const userId = normalizePositiveInteger(params.userId, 'userId');
  const organizationIds = [
    ...new Set(
      params.organizationIds
        .map((id) => normalizePositiveInteger(id, 'organizationId'))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (organizationIds.length === 0) {
    return { count: 0 };
  }

  const prisma = params.prisma ?? prismaClient;
  return prisma.userRole.deleteMany({
    where: {
      userId,
      role: {
        is: {
          organizationId: { in: organizationIds },
          scope: 'organization',
        },
      },
    },
  });
}

export async function assertSourceOrganizationRoleAssignmentAllowed(params: {
  centerUserId: number;
  prisma?: CustomerDb;
  roleIds: number[];
  sourceCustomerId: string;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const sourceCustomerId = normalizeCustomerId(params.sourceCustomerId);
  const memberships = await listActiveSourceOrganizationMemberships({
    centerUserId,
    sourceCustomerId,
  });
  const membershipOrgIds = new Set(
    memberships.map((item) => Number(item.organizationId)),
  );
  const roleOrganizationIds = await getOrganizationRoleOrganizationIds({
    prisma: params.prisma,
    roleIds: params.roleIds,
  });

  const outOfScopeOrganizationIds = [...roleOrganizationIds].filter(
    (organizationId) => !membershipOrgIds.has(organizationId),
  );
  if (outOfScopeOrganizationIds.length > 0) {
    throw new OrganizationLifecycleError(
      `不能给组织成员绑定其他组织的角色: ${outOfScopeOrganizationIds.join(', ')}`,
    );
  }
}

export async function assertOrganizationRolesRequireActiveMembership(params: {
  centerUserId?: null | number;
  prisma?: CustomerDb;
  roleIds: number[];
  sourceCustomerId: string;
}) {
  const sourceCustomerId = normalizeCustomerId(params.sourceCustomerId);
  const roleOrganizationIds = await getOrganizationRoleOrganizationIds({
    prisma: params.prisma,
    roleIds: params.roleIds,
  });
  if (roleOrganizationIds.size === 0) {
    return;
  }

  const centerUserId = params.centerUserId
    ? normalizePositiveInteger(params.centerUserId, 'centerUserId')
    : null;
  if (!centerUserId) {
    throw new OrganizationLifecycleError('组织角色只能绑定给组织 active 成员');
  }

  const memberships = await listActiveSourceOrganizationMemberships({
    centerUserId,
    sourceCustomerId,
  });
  const membershipOrgIds = new Set(
    memberships.map((item) => Number(item.organizationId)),
  );
  const outOfScopeOrganizationIds = [...roleOrganizationIds].filter(
    (organizationId) => !membershipOrgIds.has(organizationId),
  );
  if (outOfScopeOrganizationIds.length > 0) {
    throw new OrganizationLifecycleError(
      `不能给组织成员绑定其他组织的角色: ${outOfScopeOrganizationIds.join(', ')}`,
    );
  }
}

export async function syncSourceOrganizationMembershipsAfterRoleChange(params: {
  centerUserId: number;
  prisma?: CustomerDb;
  roleIds: number[];
  sourceCustomerId: string;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const sourceCustomerId = normalizeCustomerId(params.sourceCustomerId);
  const memberships = await listActiveSourceOrganizationMemberships({
    centerUserId,
    sourceCustomerId,
  });
  const ordinaryMemberships = memberships.filter(
    (item) => item.memberRole !== ORGANIZATION_MEMBER_ROLE_OWNER,
  );
  if (ordinaryMemberships.length === 0) {
    return { count: 0 };
  }

  const roleOrganizationIds = await getOrganizationRoleOrganizationIds({
    prisma: params.prisma,
    roleIds: params.roleIds,
  });
  const inactiveOrganizationIds = ordinaryMemberships
    .map((item) => Number(item.organizationId))
    .filter((organizationId) => !roleOrganizationIds.has(organizationId));
  if (inactiveOrganizationIds.length === 0) {
    return { count: 0 };
  }

  return systemDbClient.organizationMember.updateMany({
    data: { status: 'inactive' },
    where: {
      centerUserId,
      memberRole: { not: ORGANIZATION_MEMBER_ROLE_OWNER },
      organizationId: { in: inactiveOrganizationIds },
      sourceCustomerId,
      status: 'active',
    },
  });
}

export async function assertOrganizationMemberRoleChangeAllowed(params: {
  centerUserId: number;
  nextMemberRole?: string;
  nextStatus?: string;
  organizationId: number;
}) {
  const centerUserId = normalizePositiveInteger(
    params.centerUserId,
    'centerUserId',
  );
  const organizationId = normalizePositiveInteger(
    params.organizationId,
    'organizationId',
  );

  const currentMembership = await systemDbClient.organizationMember.findUnique({
    select: {
      memberRole: true,
      status: true,
    },
    where: {
      organizationId_centerUserId: {
        centerUserId,
        organizationId,
      },
    },
  });
  if (
    !currentMembership ||
    currentMembership.memberRole !== ORGANIZATION_MEMBER_ROLE_OWNER ||
    currentMembership.status !== 'active'
  ) {
    return;
  }

  const nextMemberRole = params.nextMemberRole
    ? normalizeMemberRole(params.nextMemberRole)
    : currentMembership.memberRole;
  const nextStatus = params.nextStatus
    ? String(params.nextStatus).trim()
    : currentMembership.status;
  if (
    nextMemberRole !== ORGANIZATION_MEMBER_ROLE_OWNER ||
    nextStatus !== 'active'
  ) {
    throw new OrganizationLifecycleError(
      '组织 owner 不能被移出组织或降级为普通成员',
    );
  }
}
