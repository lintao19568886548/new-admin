import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  // const userinfo = await verifyAccessToken(event);
  // if (!userinfo) {
  //   console.log('userinfo', userinfo);
  //   return unAuthorizedResponse(event);
  // }
  const billId = Number.parseInt(event.context.params.id);
  if (!billId) {
    return useResponseError('billId错误');
  }

  const bill = await prismaClient.amountBill.findUnique({
    where: {
      billId,
    },
    include: {
      eleBills: true,
      waterBills: true,
    },
  });
  return useResponseSuccess(bill);
});
