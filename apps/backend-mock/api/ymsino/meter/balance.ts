import { getDevBalance, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import {
  optionalYmsinoParam,
  requiredYmsinoParam,
  requireYmsinoUser,
  ymsinoRawPageResponse,
  ymsinoRawSuccess,
  ymsinoServerError,
  ymsinoVendorError,
} from '~/utils/thirdparty/ymsino-raw-response';

export default eventHandler(async (event) => {
  const authError = await requireYmsinoUser(event);
  if (authError) return authError;

  const query = getQuery(event);
  const dev = requiredYmsinoParam(query.dev || query.factoryNo, 'dev', event);
  if (dev.error) return dev.error;

  try {
    const response = await getDevBalance({
      Dev: dev.value,
      PtId: optionalYmsinoParam(query.ptId) || ymsinoDefaultPtId,
      RmId: optionalYmsinoParam(query.rmId),
    });
    if (!ymsinoRawSuccess(response)) {
      return ymsinoVendorError(
        response,
        event,
        'Failed to get ymsino device balance',
      );
    }

    return ymsinoRawPageResponse(response);
  } catch (error) {
    return ymsinoServerError(error, event, 'Ymsino balance request failed');
  }
});
