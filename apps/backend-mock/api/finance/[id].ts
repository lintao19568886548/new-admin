import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const financeId = Number.parseInt(event.context.params?.id ?? '');
  if (!financeId) {
    return useResponseError('financeId错误');
  }

  const finance = await prismaClient.finance.findUnique({
    where: {
      financeId,
      isDeleted: false,
    },
    include: {
      images: true,
    },
  });
  return useResponseSuccess(finance);
});
