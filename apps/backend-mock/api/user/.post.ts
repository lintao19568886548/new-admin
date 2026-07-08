import bcrypt from 'bcryptjs';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  assertOrganizationRolesRequireActiveMembership,
  ensureLegacyOrganizationMembershipsForRoleAssignment,
  OrganizationLifecycleError,
  syncSourceOrganizationMembershipsAfterRoleChange,
} from '~/utils/organization-role-policy';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';
import {
  normalizeParkIds,
  syncUserParks,
  UserParkScopeError,
} from '~/utils/user-park-scope';

function normalizeRoleIds(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }
  return [
    ...new Set(input.map(Number).filter((id) => Number.isFinite(id) && id > 0)),
  ];
}

function normalizeStatus(input: unknown, fallback = 1) {
  if (input === undefined || input === null || input === '') {
    return fallback;
  }
  return Number(input) === 0 ? 0 : 1;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const body = (await readBody(event)) as Record<string, unknown>;

  const username = String(body.username || '').trim();
  const realName = String(body.realName || '').trim();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '').trim();
  const status = normalizeStatus(body.status, 1);
  const roleIds = normalizeRoleIds(body.roleIds);
  const parkIds = normalizeParkIds(body.parkIds);

  if (!username) {
    return badRequestResponse('账号不能为空', event);
  }
  if (!realName) {
    return badRequestResponse('姓名不能为空', event);
  }
  if (!password) {
    return badRequestResponse('密码不能为空', event);
  }

  const centerCustomer = await systemDbClient.customer.findUnique({
    where: { customerId },
    select: { dbName: true, status: true },
  });
  if (!centerCustomer || Number(centerCustomer.status ?? 1) === 0) {
    return badRequestResponse('当前租户不可用，无法创建账号', event);
  }

  const existingTenantUser = await prismaScopeStorage.run(
    { customerId },
    async () =>
      prismaClient.user.findUnique({
        where: { username },
        select: { id: true, password: true, status: true },
      }),
  );

  if (existingTenantUser) {
    if (Number(existingTenantUser.status ?? 1) !== 2) {
      const centerUserBeforeSync = await systemDbClient.user.findUnique({
        where: { username },
        select: {
          customerType: true,
          id: true,
        },
      });
      if (centerUserBeforeSync) {
        const mappedCustomerType = centerUserBeforeSync.customerType
          ? String(centerUserBeforeSync.customerType)
          : '';
        if (mappedCustomerType && mappedCustomerType !== customerId) {
          setResponseStatus(event, 409);
          return useResponseError(
            `中心库账号已被租户 ${mappedCustomerType} 占用`,
            `中心库账号已被租户 ${mappedCustomerType} 占用`,
            409,
          );
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let centerUserId = centerUserBeforeSync?.id
        ? Number(centerUserBeforeSync.id)
        : null;
      let createdExistingCenterUserId: null | number = null;
      let createdOrganizationMemberIds: number[] = [];
      let ensuredRoleAssignmentOrganizationIds: number[] = [];
      let tenantTransactionCommitted = false;

      try {
        if (!centerUserId && status !== 0) {
          const createdCenterUser = await systemDbClient.user.create({
            data: {
              customerType: customerId,
              password: hashedPassword || existingTenantUser.password,
              phone: phone || null,
              realName,
              status,
              tokenVersion: 1,
              username,
            },
            select: { id: true },
          });
          centerUserId = Number(createdCenterUser.id);
          createdExistingCenterUserId = centerUserId;
        }

        await prismaScopeStorage.run({ customerId }, async () =>
          prismaClient.$transaction(async (prisma) => {
            if (status !== 0 && roleIds.length > 0 && centerUserId) {
              const membershipResult =
                await ensureLegacyOrganizationMembershipsForRoleAssignment({
                  centerUserId,
                  prisma,
                  roleIds,
                  sourceCustomerId: customerId,
                  sourceUserId: Number(existingTenantUser.id),
                });
              ensuredRoleAssignmentOrganizationIds = [
                ...ensuredRoleAssignmentOrganizationIds,
                ...membershipResult.ensuredOrganizationIds,
              ];
              createdOrganizationMemberIds = [
                ...createdOrganizationMemberIds,
                ...membershipResult.createdMemberIds,
              ];
              await assertOrganizationRolesRequireActiveMembership({
                centerUserId,
                prisma,
                roleIds,
                sourceCustomerId: customerId,
              });
            } else if (status !== 0 && roleIds.length > 0) {
              await assertOrganizationRolesRequireActiveMembership({
                centerUserId,
                prisma,
                roleIds,
                sourceCustomerId: customerId,
              });
            }

            await prisma.user.update({
              data: {
                password: hashedPassword,
                phone: phone || null,
                realName,
                status,
              },
              where: { id: Number(existingTenantUser.id) },
            });

            await prisma.userRole.deleteMany({
              where: { userId: Number(existingTenantUser.id) },
            });

            if (roleIds.length > 0) {
              const existingRoles = await prisma.role.findMany({
                select: { roleId: true },
                where: {
                  roleId: {
                    in: roleIds,
                  },
                },
              });
              const existingRoleIds = existingRoles.map((item) => item.roleId);
              if (existingRoleIds.length > 0) {
                await prisma.userRole.createMany({
                  data: existingRoleIds.map((roleId) => ({
                    roleId,
                    userId: Number(existingTenantUser.id),
                  })),
                });
              }
            }

            await syncUserParks({
              parkIds,
              prisma,
              userId: Number(existingTenantUser.id),
            });
          }),
        );
        tenantTransactionCommitted = true;

        if (centerUserId) {
          await systemDbClient.user.update({
            data: {
              customerType: customerId,
              password: hashedPassword,
              phone: phone || null,
              realName,
              status,
              tokenVersion: { increment: 1 },
            },
            where: { id: centerUserId },
          });
          await systemDbClient.refreshToken.updateMany({
            data: { revokedAt: new Date() },
            where: {
              revokedAt: null,
              userId: centerUserId,
            },
          });
          if (status !== 0) {
            await syncSourceOrganizationMembershipsAfterRoleChange({
              centerUserId,
              excludeOrganizationIds: ensuredRoleAssignmentOrganizationIds,
              roleIds,
              sourceCustomerId: customerId,
            });
          }
        } else {
          const createdCenterUser = await systemDbClient.user.create({
            data: {
              customerType: customerId,
              password: hashedPassword,
              phone: phone || null,
              realName,
              status,
              tokenVersion: 1,
              username,
            },
            select: { id: true },
          });
          centerUserId = Number(createdCenterUser.id);
          createdExistingCenterUserId = centerUserId;
        }

        await systemDbClient.userCustomerMapping.upsert({
          create: {
            centerUserId: Number(centerUserId),
            customerId,
            customerUserId: Number(existingTenantUser.id),
            dbName: centerCustomer.dbName
              ? String(centerCustomer.dbName)
              : null,
          },
          update: {
            customerUserId: Number(existingTenantUser.id),
            dbName: centerCustomer.dbName
              ? String(centerCustomer.dbName)
              : null,
          },
          where: {
            centerUserId_customerId: {
              centerUserId: Number(centerUserId),
              customerId,
            },
          },
        });

        await bumpPermissionCacheVersion(customerId).catch(() => undefined);
      } catch (error) {
        if (!tenantTransactionCommitted) {
          if (createdOrganizationMemberIds.length > 0) {
            await systemDbClient.organizationMember
              .deleteMany({
                where: { id: { in: createdOrganizationMemberIds } },
              })
              .catch(() => undefined);
          }
          if (createdExistingCenterUserId) {
            await systemDbClient.userCustomerMapping
              .deleteMany({
                where: {
                  centerUserId: createdExistingCenterUserId,
                  customerId,
                },
              })
              .catch(() => undefined);
            await systemDbClient.user
              .delete({
                where: { id: createdExistingCenterUserId },
              })
              .catch(() => undefined);
          }
        }
        if (error instanceof UserParkScopeError) {
          return badRequestResponse(error.message, event, error.statusCode);
        }
        if (error instanceof OrganizationLifecycleError) {
          return badRequestResponse(error.message, event, error.statusCode);
        }
        console.error('同步已存在账号失败:', error);
        return serverErrorResponse('同步已存在账号失败', event);
      }

      return useResponseSuccess({
        centerUserId,
        existed: true,
        id: Number(existingTenantUser.id),
        tenantUserId: Number(existingTenantUser.id),
      });
    }

    setResponseStatus(event, 409);
    return useResponseError('租户库账号已存在', '租户库账号已存在', 409);
  }

  const centerUserBeforeCreate = await systemDbClient.user.findUnique({
    where: { username },
    select: {
      id: true,
      customerType: true,
    },
  });
  if (centerUserBeforeCreate) {
    const mappedCustomerType = centerUserBeforeCreate.customerType
      ? String(centerUserBeforeCreate.customerType)
      : '';
    if (mappedCustomerType && mappedCustomerType !== customerId) {
      setResponseStatus(event, 409);
      return useResponseError(
        `中心库账号已被租户 ${mappedCustomerType} 占用`,
        `中心库账号已被租户 ${mappedCustomerType} 占用`,
        409,
      );
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  let createdCenterUserId: null | number = null;
  let createdOrganizationMemberIds: number[] = [];
  let createdTenantUserId: null | number = null;

  try {
    const tenantUser = await prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.$transaction(async (prisma) => {
        const createdUser = await prisma.user.create({
          data: {
            customerType: customerId,
            password: hashedPassword,
            phone: phone || null,
            realName,
            status,
            tokenVersion: 1,
            username,
          },
          select: { id: true },
        });

        return createdUser;
      }),
    );
    createdTenantUserId = Number(tenantUser.id);

    let centerUser = centerUserBeforeCreate;

    if (!centerUser) {
      centerUser = await systemDbClient.user.create({
        data: {
          customerType: customerId,
          password: hashedPassword,
          phone: phone || null,
          realName,
          status,
          tokenVersion: 1,
          username,
        },
        select: { id: true, customerType: true },
      });
      createdCenterUserId = Number(centerUser.id);
    }

    if (roleIds.length > 0) {
      await prismaScopeStorage.run({ customerId }, async () =>
        prismaClient.$transaction(async (prisma) => {
          const membershipResult =
            await ensureLegacyOrganizationMembershipsForRoleAssignment({
              centerUserId: Number(centerUser.id),
              prisma,
              roleIds,
              sourceCustomerId: customerId,
              sourceUserId: Number(tenantUser.id),
            });
          createdOrganizationMemberIds = [
            ...createdOrganizationMemberIds,
            ...membershipResult.createdMemberIds,
          ];
          await assertOrganizationRolesRequireActiveMembership({
            centerUserId: Number(centerUser.id),
            prisma,
            roleIds,
            sourceCustomerId: customerId,
          });

          const existingRoles = await prisma.role.findMany({
            where: {
              roleId: {
                in: roleIds,
              },
            },
            select: { roleId: true },
          });
          const existingRoleIds = existingRoles.map((item) => item.roleId);
          if (existingRoleIds.length > 0) {
            await prisma.userRole.createMany({
              data: existingRoleIds.map((roleId) => ({
                roleId,
                userId: Number(tenantUser.id),
              })),
            });
          }
        }),
      );
    }

    if (parkIds.length > 0) {
      await prismaScopeStorage.run({ customerId }, async () =>
        prismaClient.$transaction(async (prisma) => {
          await syncUserParks({
            parkIds,
            prisma,
            userId: Number(tenantUser.id),
          });
        }),
      );
    }

    if (centerUserBeforeCreate) {
      await systemDbClient.user.update({
        where: { id: Number(centerUser.id) },
        data: {
          customerType: customerId,
          password: hashedPassword,
          phone: phone || null,
          realName,
          status,
          tokenVersion: { increment: 1 },
        },
      });
      await systemDbClient.refreshToken.updateMany({
        where: {
          revokedAt: null,
          userId: Number(centerUser.id),
        },
        data: { revokedAt: new Date() },
      });
    }

    await systemDbClient.userCustomerMapping.upsert({
      where: {
        centerUserId_customerId: {
          centerUserId: Number(centerUser.id),
          customerId,
        },
      },
      create: {
        centerUserId: Number(centerUser.id),
        customerId,
        customerUserId: Number(tenantUser.id),
        dbName: centerCustomer.dbName ? String(centerCustomer.dbName) : null,
      },
      update: {
        customerUserId: Number(tenantUser.id),
        dbName: centerCustomer.dbName ? String(centerCustomer.dbName) : null,
      },
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);

    return useResponseSuccess({
      id: Number(tenantUser.id),
      centerUserId: Number(centerUser.id),
      tenantUserId: Number(tenantUser.id),
    });
  } catch (error) {
    if (createdOrganizationMemberIds.length > 0) {
      await systemDbClient.organizationMember
        .deleteMany({
          where: { id: { in: createdOrganizationMemberIds } },
        })
        .catch(() => undefined);
    }

    if (createdTenantUserId) {
      await prismaScopeStorage
        .run({ customerId }, async () => {
          await prismaClient.userRole
            .deleteMany({
              where: { userId: createdTenantUserId },
            })
            .catch(() => undefined);
          await prismaClient.userCode
            .deleteMany({
              where: { userId: createdTenantUserId },
            })
            .catch(() => undefined);
          await prismaClient.user
            .delete({
              where: { id: createdTenantUserId },
            })
            .catch(() => undefined);
        })
        .catch(() => undefined);
    }

    if (createdCenterUserId) {
      await systemDbClient.userCustomerMapping
        .deleteMany({
          where: { centerUserId: createdCenterUserId, customerId },
        })
        .catch(() => undefined);
      await systemDbClient.user
        .delete({
          where: { id: createdCenterUserId },
        })
        .catch(() => undefined);
    }

    if (error instanceof UserParkScopeError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }
    if (error instanceof OrganizationLifecycleError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('创建账号失败:', error);
    return serverErrorResponse('创建账号失败', event);
  }
});
