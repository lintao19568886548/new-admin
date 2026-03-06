import { defineEventHandler } from 'h3';
import { prismaClient } from '~/utils/db';

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
        iosUrl: null,
        version: '1.0.0',
        url: 'https://www.yizuw.cn/download/kvapp_v1.0.0.apk',
        notes: 'Initial version.',
      },
    });
  }

  // The frontend API client is configured to expect the data object directly.
  return useResponseSuccess({
    ...latestVersion,
    androidUrl: latestVersion.androidUrl || latestVersion.url,
    iosUrl: latestVersion.iosUrl,
  });
});
