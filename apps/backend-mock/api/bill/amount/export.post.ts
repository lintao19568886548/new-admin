import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const parkIds = Array.isArray(body?.parkIds)
    ? body.parkIds
        .map(Number)
        .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0)
    : [];

  const parks = await prismaClient.park.findMany({
    where: {
      ...(parkIds.length > 0 ? { parkId: { in: parkIds } } : {}),
      isDeleted: false,
    },
    select: {
      parkName: true,
      amountBills: {
        include: {
          tenant: {
            select: {
              tenantName: true,
            },
          },
        },
      },
    },
  });

  const result = parks.map((park) => {
    return {
      parkName: park.parkName,
      bills: park.amountBills.map((bill) => {
        return {
          tenantName: bill.tenant.tenantName,
          factoryRent: bill.factoryRent,
          waterFee: bill.waterFee,
          eleFee: bill.eleFee,
          serviceFee: bill.serviceFee,
          managementFee: bill.managementFee,
          invoiceTax: bill.invoiceTax,
          receiveFee: bill.receiveFee,
          garbageFee: bill.garbageFee,
          penaltyFee: bill.penaltyFee,
          totalFee: bill.totalFee,
        };
      }),
    };
  });
  return useResponseSuccess(result);
});
