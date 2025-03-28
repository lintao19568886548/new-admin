export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  const result = await db.sql`
    SELECT * FROM amount_bill
  `.then((result) => {
    console.log(result.rows);
    return result.rows;
  });
  return useResponseSuccess(result);
});
