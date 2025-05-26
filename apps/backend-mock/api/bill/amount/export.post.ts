import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  const parks = await prismaClient.park.findMany({
    where: {
      parkId: {
        in: body.parkIds,
      },
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
        };
      }),
    };
  });
  return useResponseSuccess(result);
});
