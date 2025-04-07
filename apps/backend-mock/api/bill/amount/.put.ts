import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { eleBills, waterBills, ...billData } = body;
  delete billData.tenant;
  delete billData.createTime;
  delete billData.updateTime;
  if (!billData.billId) {
    return useResponseError('billId错误');
  }

  // 使用事务来确保所有操作都成功或都失败
  const updateBill = await prismaClient.$transaction(async (tx) => {
    // 更新主账单
    const updatedAmountBill = await tx.amountBill.update({
      where: { billId: billData.billId },
      data: { ...billData },
    });

    // 批量更新电费账单
    if (eleBills && eleBills.length > 0) {
      console.log(eleBills);
      await Promise.all(
        eleBills.map((eleBill) => {
          const { eleId, billId, ...eleBillData } = eleBill; // 移除不需要的字段
          // 使用三元表达式替代if-else
          return eleId
            ? tx.eleBill.update({
                where: { eleId, billId },
                data: eleBillData, // 使用清理后的数据进行更新
              })
            : tx.eleBill.create({
                data: {
                  ...eleBillData,
                  billId: billData.billId,
                },
              });
        }),
      );
    }

    // 批量更新水费账单
    if (waterBills && waterBills.length > 0) {
      await Promise.all(
        waterBills.map((waterBill) => {
          const { waterId, billId, ...waterBillData } = waterBill; // 移除不需要的字段
          return waterId
            ? tx.waterBill.update({
                where: { waterId, billId },
                data: waterBillData, // 使用清理后的数据进行更新
              })
            : tx.waterBill.create({
                data: {
                  ...waterBillData,
                  billId: billData.billId,
                },
              });
        }),
      );
    }

    return updatedAmountBill;
  });

  return useResponseSuccess(updateBill);
});
