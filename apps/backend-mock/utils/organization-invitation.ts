import type { PrismaClient } from '@prisma/.prisma/client/index.js';

import { randomBytes } from 'node:crypto';

import { Prisma } from '@prisma/.prisma/center-client/index.js';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { applyUserRolesToUser } from '~/utils/permission-modules';

const INVITATION_CODE_BYTES = 8;
const MAX_INVITATION_RETRY = 5;
const MAX_INVITATION_USES = 500;

type CenterDb = Prisma.TransactionClient | typeof systemDbClient;

interface CenterUserSnapshot {
  customerType: null | string;
  id: number;
  password: string;
  phone: null | string;
  realName: string;
  status: null | number;
  tokenVersion: number;
  username: string;
}

interface OrganizationInvitationRecord {
  code: string;
  createTime: Date | null | string;
  createdByCenterUserId: number;
  customerId: string;
  expiresAt: Date | null | string;
  id: number;
  maxUses: null | number;
  remark: null | string;
  roleIds: string;
  status: string;
  updateTime: Date | null | string;
  usedCount: number;
}

interface OrganizationInvitationInput {
  expiresAt?: unknown;
  maxUses?: unknown;
  remark?: unknown;
  roleIds?: unknown;
}

interface PreparedTenantUser {
  created: boolean;
  customerUserId: number;
}

export class OrganizationInvitationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'OrganizationInvitationError';
  }
}

function getDefaultCustomerId() {
  return String(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function normalizeCustomerId(value: unknown) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new OrganizationInvitationError('组织 customerId 不合法');
  }
  return customerId;
}

function normalizeInvitationCode(value: unknown) {
  const code = String(value || '')
    .trim()
    .replaceAll(/[\s-]+/g, '')
    .toUpperCase();
  if (!code) {
    throw new OrganizationInvitationError('邀请码不能为空');
  }
  if (!/^[A-Z0-9]{6,32}$/.test(code)) {
    throw new OrganizationInvitationError('邀请码格式不正确');
  }
  return code;
}

function generateInvitationCode() {
  return randomBytes(INVITATION_CODE_BYTES).toString('hex').toUpperCase();
}

function parseRoleIds(value: unknown) {
  let rawItems: unknown[] = [];
  if (Array.isArray(value)) {
    rawItems = value;
  } else if (typeof value === 'string') {
    rawItems = value.split(',');
  }

  const roleIds = [
    ...new Set(
      rawItems
        .map(Number)
        .filter((item) => Number.isFinite(item) && item > 0)
        .map((item) => Math.floor(item)),
    ),
  ];

  if (roleIds.length === 0) {
    throw new OrganizationInvitationError('创建邀请码必须指定至少一个组织角色');
  }

  if (roleIds.length > 20) {
    throw new OrganizationInvitationError('邀请码角色数量不能超过 20 个');
  }

  return roleIds;
}

function parseMaxUses(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const maxUses = Number(value);
  if (!Number.isFinite(maxUses) || maxUses <= 0) {
    throw new OrganizationInvitationError('最大使用次数必须为正整数');
  }

  const normalized = Math.floor(maxUses);
  if (normalized > MAX_INVITATION_USES) {
    throw new OrganizationInvitationError(
      `单个邀请码最多允许使用 ${MAX_INVITATION_USES} 次`,
    );
  }

  return normalized;
}

function parseExpiresAt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const expiresAt = new Date(String(value));
  if (Number.isNaN(expiresAt.getTime())) {
    throw new OrganizationInvitationError('邀请码过期时间格式不正确');
  }

  if (expiresAt.getTime() <= Date.now()) {
    throw new OrganizationInvitationError('邀请码过期时间必须晚于当前时间');
  }

  return expiresAt;
}

function normalizeRemark(value: unknown) {
  const remark = String(value ?? '').trim();
  if (!remark) {
    return null;
  }
  if (remark.length > 200) {
    throw new OrganizationInvitationError('备注不能超过 200 个字符');
  }
  return remark;
}

function normalizeDateValue(value: Date | null | string) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function serializeDate(value: Date | null | string) {
  return normalizeDateValue(value)?.toISOString() ?? null;
}

function parseStoredRoleIds(value: unknown) {
  return String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));
}

function serializeInvitation(record: OrganizationInvitationRecord) {
  return {
    code: record.code,
    createTime: serializeDate(record.createTime),
    createdByCenterUserId: Number(record.createdByCenterUserId),
    customerId: record.customerId,
    expiresAt: serializeDate(record.expiresAt),
    id: Number(record.id),
    maxUses: record.maxUses === null ? null : Number(record.maxUses),
    remark: record.remark,
    roleIds: parseStoredRoleIds(record.roleIds),
    status: record.status,
    updateTime: serializeDate(record.updateTime),
    usedCount: Number(record.usedCount),
  };
}

function invitationSelectSql() {
  return Prisma.sql`
    SELECT
      id,
      code,
      customer_id AS customerId,
      created_by_center_user_id AS createdByCenterUserId,
      role_ids AS roleIds,
      max_uses AS maxUses,
      used_count AS usedCount,
      expires_at AS expiresAt,
      status,
      remark,
      create_time AS createTime,
      update_time AS updateTime
    FROM tenant_invitation
  `;
}

async function queryInvitationByCode(
  code: string,
  db: CenterDb = systemDbClient,
) {
  const rows = await db.$queryRaw<OrganizationInvitationRecord[]>(Prisma.sql`
    ${invitationSelectSql()}
    WHERE code = ${code}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function queryInvitationByCodeForUpdate(code: string, db: CenterDb) {
  const rows = await db.$queryRaw<OrganizationInvitationRecord[]>(Prisma.sql`
    ${invitationSelectSql()}
    WHERE code = ${code}
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function validateTargetRoles(params: {
  customerId: string;
  dbName: null | string;
  roleIds: number[];
}) {
  const roles = await prismaScopeStorage.run(
    {
      customerId: params.customerId,
      dbName: params.dbName,
    },
    async () =>
      prismaClient.role.findMany({
        where: {
          roleId: {
            in: params.roleIds,
          },
          status: true,
        },
        select: {
          roleId: true,
        },
      }),
  );

  const existingRoleIds = new Set(roles.map((item) => Number(item.roleId)));
  const missingRoleIds = params.roleIds.filter(
    (id) => !existingRoleIds.has(id),
  );
  if (missingRoleIds.length > 0) {
    throw new OrganizationInvitationError(
      `组织角色不存在或已停用: ${missingRoleIds.join(', ')}`,
    );
  }
}

async function resolveManageableCustomer(customerId: string) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const customer = await systemDbClient.customer.findUnique({
    where: { customerId: normalizedCustomerId },
    select: { customerId: true, dbName: true, name: true, status: true },
  });

  if (!customer || Number(customer.status ?? 1) !== 1) {
    throw new OrganizationInvitationError('组织空间不存在或已停用', 404);
  }

  if (
    normalizedCustomerId === 'public' ||
    normalizedCustomerId === getDefaultCustomerId()
  ) {
    throw new OrganizationInvitationError(
      '公共库和默认库不能创建组织邀请码',
      403,
    );
  }

  return {
    customerId: String(customer.customerId),
    dbName: customer.dbName ? String(customer.dbName) : null,
    name: String(customer.name || customer.customerId),
  };
}

async function prepareTenantUserForJoin(params: {
  centerDb: CenterDb;
  centerUser: CenterUserSnapshot;
  customerId: string;
  dbName: null | string;
  roleIds: number[];
}): Promise<PreparedTenantUser> {
  const centerUserId = Number(params.centerUser.id);
  const username = String(params.centerUser.username || '').trim();

  if (!username) {
    throw new OrganizationInvitationError('当前账号缺少用户名，不能加入组织');
  }

  return prismaScopeStorage.run(
    {
      customerId: params.customerId,
      dbName: params.dbName,
    },
    async () => {
      const mapped = await params.centerDb.userCustomerMapping.findUnique({
        where: {
          centerUserId_customerId: {
            centerUserId,
            customerId: params.customerId,
          },
        },
        select: {
          customerUserId: true,
        },
      });

      if (mapped) {
        const mappedTenantUser = await prismaClient.user.findUnique({
          where: { id: Number(mapped.customerUserId) },
          select: { id: true, status: true },
        });
        if (!mappedTenantUser || Number(mappedTenantUser.status ?? 1) !== 1) {
          throw new OrganizationInvitationError(
            '当前账号在目标组织空间的映射异常，请联系管理员处理',
            409,
          );
        }

        await applyUserRolesToUser({
          prisma: prismaClient as PrismaClient,
          roleIds: params.roleIds,
          userId: Number(mappedTenantUser.id),
        });

        return {
          created: false,
          customerUserId: Number(mappedTenantUser.id),
        };
      }

      const existingTenantUser = await prismaClient.user.findUnique({
        where: { username },
        select: { id: true, status: true },
      });

      if (existingTenantUser) {
        if (Number(existingTenantUser.status ?? 1) !== 1) {
          throw new OrganizationInvitationError(
            '目标组织空间已存在同名停用账号，请联系管理员处理',
            409,
          );
        }

        const mappedByTenantUser =
          await params.centerDb.userCustomerMapping.findUnique({
            where: {
              customerId_customerUserId: {
                customerId: params.customerId,
                customerUserId: Number(existingTenantUser.id),
              },
            },
            select: {
              centerUserId: true,
            },
          });

        if (
          mappedByTenantUser &&
          Number(mappedByTenantUser.centerUserId) !== centerUserId
        ) {
          throw new OrganizationInvitationError(
            '目标组织空间已存在同名账号，请联系管理员处理',
            409,
          );
        }

        await applyUserRolesToUser({
          prisma: prismaClient as PrismaClient,
          roleIds: params.roleIds,
          userId: Number(existingTenantUser.id),
        });

        return {
          created: false,
          customerUserId: Number(existingTenantUser.id),
        };
      }

      const createdTenantUser = await prismaClient.user.create({
        data: {
          customerType: params.customerId,
          password: params.centerUser.password,
          phone: params.centerUser.phone,
          realName: params.centerUser.realName,
          status: 1,
          tokenVersion: 1,
          username,
        },
        select: { id: true },
      });

      try {
        await applyUserRolesToUser({
          prisma: prismaClient as PrismaClient,
          roleIds: params.roleIds,
          userId: Number(createdTenantUser.id),
        });
      } catch (error) {
        await cleanupCreatedTenantUser({
          customerId: params.customerId,
          customerUserId: Number(createdTenantUser.id),
          dbName: params.dbName,
        }).catch((cleanupError) => {
          console.error('清理角色写入失败的租户账号失败:', cleanupError);
        });
        throw error;
      }

      return {
        created: true,
        customerUserId: Number(createdTenantUser.id),
      };
    },
  );
}

async function cleanupCreatedTenantUser(params: {
  customerId: string;
  customerUserId: number;
  dbName: null | string;
}) {
  await prismaScopeStorage.run(
    {
      customerId: params.customerId,
      dbName: params.dbName,
    },
    async () => {
      await prismaClient.userRole.deleteMany({
        where: { userId: params.customerUserId },
      });
      await prismaClient.userCode.deleteMany({
        where: { userId: params.customerUserId },
      });
      await prismaClient.user.delete({
        where: { id: params.customerUserId },
      });
    },
  );
}

async function recordJoinFailureBestEffort(params: {
  centerUserId: number;
  code: string;
  customerId?: string;
  errorMessage: string;
  invitationId?: number;
  previousCustomerId?: null | string;
}) {
  if (!params.invitationId || !params.customerId) {
    return;
  }

  await systemDbClient
    .$executeRaw(
      Prisma.sql`
      INSERT INTO tenant_invitation_join_log (
        invitation_id,
        code,
        customer_id,
        center_user_id,
        previous_customer_id,
        status,
        error_message,
        create_time,
        update_time
      ) VALUES (
        ${params.invitationId},
        ${params.code},
        ${params.customerId},
        ${params.centerUserId},
        ${params.previousCustomerId ?? null},
        'failed',
        ${params.errorMessage.slice(0, 2000)},
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        previous_customer_id = VALUES(previous_customer_id),
        status = 'failed',
        error_message = VALUES(error_message),
        update_time = NOW()
    `,
    )
    .catch(() => undefined);
}

function assertInvitationUsable(invitation: OrganizationInvitationRecord) {
  if (invitation.status !== 'active') {
    throw new OrganizationInvitationError('邀请码已失效');
  }

  const expiresAt = normalizeDateValue(invitation.expiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new OrganizationInvitationError('邀请码已过期');
  }

  if (
    invitation.maxUses !== null &&
    Number(invitation.usedCount) >= Number(invitation.maxUses)
  ) {
    throw new OrganizationInvitationError('邀请码使用次数已用完');
  }
}

export async function createOrganizationInvitation(params: {
  createdByCenterUserId: number;
  customerId: string;
  input: OrganizationInvitationInput;
}) {
  const customer = await resolveManageableCustomer(params.customerId);
  const roleIds = parseRoleIds(params.input.roleIds);
  const maxUses = parseMaxUses(params.input.maxUses);
  const expiresAt = parseExpiresAt(params.input.expiresAt);
  const remark = normalizeRemark(params.input.remark);

  await validateTargetRoles({
    customerId: customer.customerId,
    dbName: customer.dbName,
    roleIds,
  });

  for (let attempt = 0; attempt < MAX_INVITATION_RETRY; attempt += 1) {
    const code = generateInvitationCode();
    try {
      await systemDbClient.$executeRaw(Prisma.sql`
        INSERT INTO tenant_invitation (
          code,
          customer_id,
          created_by_center_user_id,
          role_ids,
          max_uses,
          used_count,
          expires_at,
          status,
          remark,
          create_time,
          update_time
        ) VALUES (
          ${code},
          ${customer.customerId},
          ${params.createdByCenterUserId},
          ${roleIds.join(',')},
          ${maxUses},
          0,
          ${expiresAt},
          'active',
          ${remark},
          NOW(),
          NOW()
        )
      `);

      const invitation = await queryInvitationByCode(code);
      if (!invitation) {
        throw new Error('邀请码创建后读取失败');
      }

      return {
        invitation: serializeInvitation(invitation),
        organizationSpace: customer,
      };
    } catch (error) {
      if (attempt < MAX_INVITATION_RETRY - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('邀请码创建失败');
}

export async function listOrganizationInvitations(customerId: string) {
  const customer = await resolveManageableCustomer(customerId);
  const rows = await systemDbClient.$queryRaw<OrganizationInvitationRecord[]>(
    Prisma.sql`
      ${invitationSelectSql()}
      WHERE customer_id = ${customer.customerId}
      ORDER BY id DESC
      LIMIT 100
    `,
  );

  return {
    items: rows.map((row) => serializeInvitation(row)),
    total: rows.length,
  };
}

export async function revokeOrganizationInvitation(params: {
  customerId: string;
  invitationId: unknown;
}) {
  const customer = await resolveManageableCustomer(params.customerId);
  const invitationId = Number(params.invitationId);
  if (!Number.isFinite(invitationId) || invitationId <= 0) {
    throw new OrganizationInvitationError('邀请码 ID 不合法');
  }

  const affected = await systemDbClient.$executeRaw(Prisma.sql`
    UPDATE tenant_invitation
    SET status = 'revoked', update_time = NOW()
    WHERE id = ${Math.floor(invitationId)}
      AND customer_id = ${customer.customerId}
      AND status = 'active'
  `);

  if (affected === 0) {
    throw new OrganizationInvitationError('邀请码不存在或已失效', 404);
  }

  return { revoked: true };
}

export async function joinOrganizationByInvitationCode(params: {
  centerUserId: number;
  code: unknown;
}) {
  const code = normalizeInvitationCode(params.code);
  const centerUserId = Number(params.centerUserId);
  if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
    throw new OrganizationInvitationError('登录状态异常', 401);
  }

  let createdTenantUser: null | {
    customerId: string;
    customerUserId: number;
    dbName: null | string;
  } = null;
  let failureContext: null | {
    customerId: string;
    invitationId: number;
    previousCustomerId: null | string;
  } = null;

  try {
    return await systemDbClient.$transaction(async (tx) => {
      const invitation = await queryInvitationByCodeForUpdate(code, tx);
      if (!invitation) {
        throw new OrganizationInvitationError('邀请码不存在或已失效', 404);
      }
      assertInvitationUsable(invitation);

      const roleIds = parseStoredRoleIds(invitation.roleIds);
      if (roleIds.length === 0) {
        throw new OrganizationInvitationError(
          '邀请码未配置角色，请联系管理员重新创建',
          409,
        );
      }

      const [customer, centerUser] = await Promise.all([
        tx.customer.findUnique({
          where: { customerId: invitation.customerId },
          select: { dbName: true, name: true, status: true },
        }),
        tx.user.findUnique({
          where: { id: centerUserId },
          select: {
            customerType: true,
            id: true,
            password: true,
            phone: true,
            realName: true,
            status: true,
            tokenVersion: true,
            username: true,
          },
        }),
      ]);

      if (!customer || Number(customer.status ?? 1) !== 1) {
        throw new OrganizationInvitationError(
          '目标组织空间不存在或已停用',
          404,
        );
      }
      if (!centerUser || Number(centerUser.status ?? 1) !== 1) {
        throw new OrganizationInvitationError('当前账号不存在或已停用', 401);
      }

      const targetCustomerId = normalizeCustomerId(invitation.customerId);
      const previousCustomerId = centerUser.customerType
        ? String(centerUser.customerType)
        : null;
      const defaultCustomerId = getDefaultCustomerId();
      const targetDbName = customer.dbName ? String(customer.dbName) : null;
      failureContext = {
        customerId: targetCustomerId,
        invitationId: Number(invitation.id),
        previousCustomerId,
      };

      if (previousCustomerId === targetCustomerId) {
        return {
          alreadyJoined: true,
          customerId: targetCustomerId,
          customerName: String(customer.name || targetCustomerId),
          joined: true,
          organizationSpaceId: targetCustomerId,
          organizationSpaceName: String(customer.name || targetCustomerId),
          requiresRelogin: false,
        };
      }

      if (
        previousCustomerId &&
        previousCustomerId !== 'public' &&
        previousCustomerId !== defaultCustomerId
      ) {
        throw new OrganizationInvitationError(
          '当前账号已属于其他组织空间，不能直接加入新的组织',
          409,
        );
      }

      if (previousCustomerId === defaultCustomerId) {
        throw new OrganizationInvitationError(
          '默认库账号不能通过邀请码加入组织',
          403,
        );
      }

      await validateTargetRoles({
        customerId: targetCustomerId,
        dbName: targetDbName,
        roleIds,
      });

      const tenantUser = await prepareTenantUserForJoin({
        centerDb: tx,
        centerUser: centerUser as CenterUserSnapshot,
        customerId: targetCustomerId,
        dbName: targetDbName,
        roleIds,
      });
      if (tenantUser.created) {
        createdTenantUser = {
          customerId: targetCustomerId,
          customerUserId: tenantUser.customerUserId,
          dbName: targetDbName,
        };
      }

      await tx.userCustomerMapping.upsert({
        create: {
          centerUserId,
          customerId: targetCustomerId,
          customerUserId: tenantUser.customerUserId,
          dbName: targetDbName,
        },
        update: {
          customerUserId: tenantUser.customerUserId,
          dbName: targetDbName,
        },
        where: {
          centerUserId_customerId: {
            centerUserId,
            customerId: targetCustomerId,
          },
        },
      });

      await tx.user.update({
        data: {
          customerType: targetCustomerId,
          tokenVersion: {
            increment: 1,
          },
        },
        where: { id: centerUserId },
      });

      await tx.refreshToken.updateMany({
        data: { revokedAt: new Date() },
        where: { userId: centerUserId, revokedAt: null },
      });

      await tx.$executeRaw(Prisma.sql`
        UPDATE tenant_invitation
        SET used_count = used_count + 1, update_time = NOW()
        WHERE id = ${Number(invitation.id)}
      `);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO tenant_invitation_join_log (
          invitation_id,
          code,
          customer_id,
          center_user_id,
          customer_user_id,
          previous_customer_id,
          status,
          error_message,
          joined_at,
          create_time,
          update_time
        ) VALUES (
          ${Number(invitation.id)},
          ${invitation.code},
          ${targetCustomerId},
          ${centerUserId},
          ${tenantUser.customerUserId},
          ${previousCustomerId},
          'joined',
          NULL,
          NOW(),
          NOW(),
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          customer_user_id = VALUES(customer_user_id),
          previous_customer_id = VALUES(previous_customer_id),
          status = 'joined',
          error_message = NULL,
          joined_at = NOW(),
          update_time = NOW()
      `);

      createdTenantUser = null;

      return {
        alreadyJoined: false,
        customerId: targetCustomerId,
        customerName: String(customer.name || targetCustomerId),
        joined: true,
        organizationSpaceId: targetCustomerId,
        organizationSpaceName: String(customer.name || targetCustomerId),
        requiresRelogin: true,
      };
    });
  } catch (error) {
    if (createdTenantUser) {
      await cleanupCreatedTenantUser(createdTenantUser).catch(
        (cleanupError) => {
          console.error('清理加入租户时创建的租户账号失败:', cleanupError);
        },
      );
    }

    await recordJoinFailureBestEffort({
      centerUserId,
      code,
      customerId: failureContext?.customerId,
      errorMessage: error instanceof Error ? error.message : String(error),
      invitationId: failureContext?.invitationId,
      previousCustomerId: failureContext?.previousCustomerId,
    });

    throw error;
  }
}
