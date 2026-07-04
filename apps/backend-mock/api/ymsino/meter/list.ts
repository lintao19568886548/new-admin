import { getInfo, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import {
  optionalYmsinoParam,
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
  const ptId = optionalYmsinoParam(query.ptId) || ymsinoDefaultPtId;

  try {
    const response = await getInfo({
      PtId: ptId,
      RmId: optionalYmsinoParam(query.rmId),
      TjType: optionalYmsinoParam(query.tjType),
    });
    if (!ymsinoRawSuccess(response)) {
      return ymsinoVendorError(response, event, 'Failed to get ymsino meters');
    }

    return ymsinoRawPageResponse(response);
  } catch (error) {
    return ymsinoServerError(error, event, 'Ymsino meter request failed');
  }
});
