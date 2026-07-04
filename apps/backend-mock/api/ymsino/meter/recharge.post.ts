import { rechargeDev, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import {
  badRequestResponse,
  optionalYmsinoParam,
  requiredYmsinoParam,
  requireYmsinoUser,
  ymsinoRawSuccess,
  ymsinoServerError,
  ymsinoVendorError,
} from '~/utils/thirdparty/ymsino-raw-response';

export default eventHandler(async (event) => {
  const authError = await requireYmsinoUser(event);
  if (authError) return authError;

  const body = await readBody(event);
  const dev = requiredYmsinoParam(body?.dev || body?.factoryNo, 'dev', event);
  const money = requiredYmsinoParam(body?.money, 'money', event);
  const sid = requiredYmsinoParam(body?.sid, 'sid', event);
  if (dev.error) return dev.error;
  if (money.error) return money.error;
  if (sid.error) return sid.error;
  if (Number(money.value) <= 0) {
    return badRequestResponse('money must be greater than 0', event);
  }

  try {
    const response = await rechargeDev({
      Ctime: optionalYmsinoParam(body?.ctime),
      Dev: dev.value,
      Money: money.value,
      PayFrom: optionalYmsinoParam(body?.payFrom),
      PtId: optionalYmsinoParam(body?.ptId) || ymsinoDefaultPtId,
      Sid: sid.value,
    });
    if (!ymsinoRawSuccess(response)) {
      return ymsinoVendorError(
        response,
        event,
        'Failed to recharge ymsino device',
      );
    }

    return { code: 0, data: response, error: null, message: 'ok' };
  } catch (error) {
    return ymsinoServerError(error, event, 'Ymsino device recharge failed');
  }
});
