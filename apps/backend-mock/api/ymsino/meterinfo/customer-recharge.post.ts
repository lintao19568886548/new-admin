import {
  badRequestResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { rechargeCus, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import { normalizeYmsinoRechargeCommand } from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);
  const roomId = String(body?.rmId || body?.roomId || '').trim();
  const money = String(body?.money || '').trim();
  const sid = String(body?.sid || '').trim();

  if (!roomId) {
    return badRequestResponse('Missing room number rmId/roomId', event);
  }
  if (!money || Number(money) <= 0) {
    return badRequestResponse('Recharge amount must be greater than 0', event);
  }
  if (!sid) {
    return badRequestResponse('Missing business serial number sid', event);
  }

  const response = await rechargeCus({
    Ctime: body?.ctime,
    Money: money,
    PayFrom: body?.payFrom,
    PtId: String(body?.ptId || ymsinoDefaultPtId),
    RmId: roomId,
    Sid: sid,
  });

  return useResponseSuccess(
    normalizeYmsinoRechargeCommand(response, 'tenantRecharge', sid),
  );
});
