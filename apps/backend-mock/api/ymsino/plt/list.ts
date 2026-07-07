import { getPlt } from '~/utils/thirdparty/ymsino';
import {
  requireYmsinoUser,
  ymsinoRawPageResponse,
  ymsinoRawSuccess,
  ymsinoServerError,
  ymsinoVendorError,
} from '~/utils/thirdparty/ymsino-raw-response';

export default eventHandler(async (event) => {
  const authError = await requireYmsinoUser(event);
  if (authError) return authError;

  try {
    const response = await getPlt();
    if (!ymsinoRawSuccess(response)) {
      return ymsinoVendorError(response, event, 'Failed to get ymsino parks');
    }

    return ymsinoRawPageResponse(response);
  } catch (error) {
    return ymsinoServerError(error, event, 'Ymsino park request failed');
  }
});
