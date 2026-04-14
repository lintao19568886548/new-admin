import { defineEventHandler } from 'h3';
import { prismaClient } from '~/utils/db';

const IOS_STORE_URL =
  'https://apps.apple.com/cn/app/%E7%9E%B0%E7%BB%B4%E6%99%BA%E7%AE%A1/id6760279136';

export default defineEventHandler(async () => {
  let latestVersion = await prismaClient.appVersion.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
  });

  // If no version is in the DB, create a default one
  if (!latestVersion) {
    latestVersion = await prismaClient.appVersion.create({
      data: {
        androidUrl: 'https://www.yizuw.cn/download/kvapp_v1.0.0.apk',
        version: '1.0.0',
        notes: 'Initial version.',
      },
    });
  }

  // iOS 商店地址固定由后端返回，不再存储在数据库中。
  return useResponseSuccess({
    ...latestVersion,
    iosUrl: IOS_STORE_URL,
  });
});
