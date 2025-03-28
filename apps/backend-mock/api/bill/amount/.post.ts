export default eventHandler(async (event) => {
  // const userinfo = await verifyAccessToken(event);
  // if (!userinfo) {
  //   console.log('userinfo', userinfo);
  //   return unAuthorizedResponse(event);
  // }
  const body = await readBody(event);
  console.log('请求体参数:', body);

  try {
    // 从 body 中提取需要插入的字段
    // 假设 amount_bill 表有这些字段：amount, category, date, description 等
    const { tenantId, tenantName } = body;

    // 插入数据到数据库
    const insertResult = await db.sql`
      INSERT INTO amount_bill (tenant_id, tenant_name)
      VALUES (${tenantId}, ${tenantName});
    `;
    console.log('插入数据成功:', insertResult);
    return useResponseSuccess(insertResult);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
