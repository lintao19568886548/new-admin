import bcrypt from 'bcryptjs'; // 导入 bcryptjs
import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const user = await systemDbClient.user.findUnique({
    where: {
      username: userinfo.username,
    },
  });
  const { oldPassword, newPassword } = body;

  if (!user) {
    return useResponseError('用户不存在');
  }

  // 比较用户提供的旧密码和数据库中存储的哈希密码
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isOldPasswordValid) {
    return useResponseError('原密码错误');
  }

  // 对新密码进行哈希处理
  const saltRounds = 10; // 哈希计算的轮数，越高越安全但越慢
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  await systemDbClient.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedNewPassword, // 存储哈希后的新密码
        tokenVersion: { increment: 1 },
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  // 考虑是否返回更新后的用户信息，或者仅返回成功状态
  // 为了安全，通常不直接返回包含敏感信息（如密码哈希）的完整 userinfo
  return useResponseSuccess({ message: '密码修改成功' });
});
