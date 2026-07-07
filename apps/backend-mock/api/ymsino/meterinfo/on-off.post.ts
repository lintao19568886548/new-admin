import {
  badRequestResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { doOnOff, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import { normalizeYmsinoOnOffCommand } from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);
  const deviceNo = String(body?.dev || body?.factoryNo || '').trim();
  const action = String(body?.action || '').trim();
  const commandId = String(body?.commandId || body?.sid || '').trim();
  const type = normalizeOnOffType(body?.type, action);

  if (!deviceNo) {
    return badRequestResponse('Missing device number dev/factoryNo', event);
  }
  if (!type) {
    return badRequestResponse(
      'Missing relay type/action, supports switchOn/switchOff',
      event,
    );
  }
  if (!commandId) {
    return badRequestResponse(
      'Missing commandId/sid for command-loop tracking',
      event,
    );
  }

  const response = await doOnOff({
    Dev: deviceNo,
    PtId: String(body?.ptId || ymsinoDefaultPtId),
    Type: type,
  });

  return useResponseSuccess(
    normalizeYmsinoOnOffCommand(
      response,
      type === '1' ? 'switchOn' : 'switchOff',
      commandId,
    ),
  );
});

function normalizeOnOffType(type: unknown, action: string): '0' | '1' | null {
  if (type === '0' || type === 0) return '0';
  if (type === '1' || type === 1) return '1';
  if (['off', 'openRelay', 'pullOff', 'switchOff'].includes(action)) return '0';
  if (['closeRelay', 'on', 'switchOn'].includes(action)) return '1';
  return null;
}
