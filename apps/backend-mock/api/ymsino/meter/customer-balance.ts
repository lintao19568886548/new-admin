import { getCusBalance, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
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
  const rmId = requiredYmsinoParam(query.rmId || query.roomId, 'rmId', event);
  if (rmId.error) return rmId.error;

  try {
    const response = await getCusBalance({
      PtId: optionalYmsinoParam(query.ptId) || ymsinoDefaultPtId,
      RmId: rmId.value,
    });
    if (!ymsinoRawSuccess(response)) {
      return ymsinoVendorError(
        response,
        event,
        'Failed to get ymsino customer balance',
      );
    }

    return ymsinoRawPageResponse(response);
  } catch (error) {
    return ymsinoServerError(
      error,
      event,
      'Ymsino customer balance request failed',
    );
  }
});
