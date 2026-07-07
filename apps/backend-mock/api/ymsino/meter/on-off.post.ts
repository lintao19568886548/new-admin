import { doOnOff, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import {
  badRequestResponse,
  optionalYmsinoParam,
  requiredYmsinoParam,
  requireYmsinoUser,
  ymsinoServerError,
} from '~/utils/thirdparty/ymsino-raw-response';

export default eventHandler(async (event) => {
  const authError = await requireYmsinoUser(event);
  if (authError) return authError;

  const body = await readBody(event);
  const dev = requiredYmsinoParam(body?.dev || body?.factoryNo, 'dev', event);
  const type = normalizeOnOffType(body?.type, body?.action);
  if (dev.error) return dev.error;
  if (!type) {
    return badRequestResponse('type must be 0(close) or 1(open)', event);
  }

  try {
    const response = await doOnOff({
      Dev: dev.value,
      PtId: optionalYmsinoParam(body?.ptId) || ymsinoDefaultPtId,
      Type: type,
    });

    return { code: 0, data: response, error: null, message: 'ok' };
  } catch (error) {
    return ymsinoServerError(error, event, 'Ymsino on-off request failed');
  }
});

function normalizeOnOffType(type: unknown, action: unknown): '0' | '1' | null {
  if (type === '0' || type === 0) return '0';
  if (type === '1' || type === 1) return '1';

  const normalized = String(action ?? '').trim();
  if (
    ['closeRelay', 'off', 'openRelay', 'pullOff', 'switchOff'].includes(
      normalized,
    )
  ) {
    return '0';
  }
  if (['close', 'closeSwitch', 'on', 'switchOn'].includes(normalized)) {
    return '1';
  }

  return null;
}
