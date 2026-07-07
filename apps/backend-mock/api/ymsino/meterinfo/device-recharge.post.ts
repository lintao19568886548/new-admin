import {
  badRequestResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { rechargeDev, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import { normalizeYmsinoRechargeCommand } from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);
  const deviceNo = String(body?.dev || body?.factoryNo || '').trim();
  const money = String(body?.money || '').trim();
  const sid = String(body?.sid || '').trim();

  if (!deviceNo) {
    return badRequestResponse('Missing device number dev/factoryNo', event);
  }
  if (!money || Number(money) <= 0) {
    return badRequestResponse('Recharge amount must be greater than 0', event);
  }
  if (!sid) {
    return badRequestResponse('Missing business serial number sid', event);
  }

  const response = await rechargeDev({
    Ctime: body?.ctime,
    Dev: deviceNo,
    Money: money,
    PayFrom: body?.payFrom,
    PtId: String(body?.ptId || ymsinoDefaultPtId),
    Sid: sid,
  });

  return useResponseSuccess(
    normalizeYmsinoRechargeCommand(response, 'deviceRecharge', sid),
  );
});
