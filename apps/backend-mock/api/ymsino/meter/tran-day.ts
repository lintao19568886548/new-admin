import dayjs from 'dayjs';
import { getTranDay, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
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
  const tyDate =
    optionalYmsinoParam(query.tyDate) || dayjs().format('YYYY-MM-DD');

  try {
    const response = await getTranDay({
      PtId: ptId,
      RmId: optionalYmsinoParam(query.rmId),
      TjType: optionalYmsinoParam(query.tjType),
      TyDate: tyDate,
    });
    if (!ymsinoRawSuccess(response)) {
      return ymsinoVendorError(
        response,
        event,
        'Failed to get ymsino daily readings',
      );
    }

    return ymsinoRawPageResponse(response);
  } catch (error) {
    return ymsinoServerError(
      error,
      event,
      'Ymsino daily reading request failed',
    );
  }
});
