import { verifyAccessToken } from '~/utils/jwt-utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    setResponseStatus(event, 401);
    return useResponseError('登录失效，请重新登录');
  }
  return useResponseSuccess(userinfo);
});
