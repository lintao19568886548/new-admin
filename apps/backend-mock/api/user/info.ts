import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getCachedUserInfo, setCachedUserInfo } from '~/utils/permission-cache';
import {
  fetchUserWithDetails,
  transformPrismaUserToUserInfo,
} from '~/utils/user-service';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    setResponseStatus(event, 401);
    return useResponseError('登录失效，请重新登录');
  }

  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const customerId = String(userinfo.customerId || defaultCustomerId);
  const cached = await getCachedUserInfo({
    customerId,
    userId: Number(userinfo.id),
  }).catch(() => null);
  if (cached) {
    return useResponseSuccess(cached);
  }

  const currentUserFromDB = await fetchUserWithDetails(
    userinfo.username,
    prismaClient,
  );
  if (!currentUserFromDB) {
    setResponseStatus(event, 401);
    return useResponseError('登录失效，请重新登录');
  }

  const refreshedRaw = await transformPrismaUserToUserInfo(
    currentUserFromDB,
    prismaClient,
  );
  const refreshed = { ...refreshedRaw, customerId };
  await setCachedUserInfo({
    customerId,
    userId: refreshed.id,
    value: refreshed,
  }).catch(() => undefined);

  return useResponseSuccess(refreshed);
});
