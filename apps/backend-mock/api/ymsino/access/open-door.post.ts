import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { notApplicableYmsinoCommand } from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  await readBody(event);

  return useResponseSuccess(
    notApplicableYmsinoCommand(
      'openDoor',
      'Ymsino does not provide access-control devices in this integration; open-door is outside the ymsino meter scope',
    ),
  );
});
