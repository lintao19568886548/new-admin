import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 使用用户ID从user_code表中查询权限码
  // const codeResult = await db.sql`
  //   SELECT code FROM user_code
  //   WHERE id = ${userinfo.id}
  //   LIMIT 1
  // `.then((result) => result.rows?.[0]?.code || '[]');

  // 将字符串形式的权限码转换为数组
  const codes = [];
  // if (typeof codeResult === 'string') {
  //   try {
  //     codes = JSON.parse(codeResult);
  //   } catch (error) {
  //     console.error('JSON解析错误:', error);

  //     // 尝试处理可能的特殊格式
  //     if (codeResult.startsWith('[') && codeResult.includes(',')) {
  //       // 可能是带单引号而不是双引号的数组字符串
  //       try {
  //         // 将单引号替换为双引号
  //         const fixedString = codeResult.replaceAll("'", '"');
  //         codes = JSON.parse(fixedString);
  //       } catch (error_) {
  //         console.error('修复后仍然解析失败:', error_);
  //       }
  //     }
  //   }
  // } else if (Array.isArray(codeResult)) {
  //   codes = codeResult;

  return useResponseSuccess(codes);
});
