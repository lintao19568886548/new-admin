import {
  buildAmountBillCollectionSmsSummary,
  listAmountBillCollectionSmsCandidates,
  normalizeAmountBillCollectionSmsOptions,
} from '~/utils/amount-bill-collection-sms';
import { useResponseSuccess } from '~/utils/response';

function buildOptionsFromBody(body: Record<string, any>) {
  const filters = { ...body.filters };
  if (body.currentPark !== undefined) {
    filters.currentPark = body.currentPark;
  }

  return normalizeAmountBillCollectionSmsOptions({
    ...body,
    filters,
  });
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event)) || {}) as Record<string, any>;
  const options = buildOptionsFromBody(body);
  const items = await listAmountBillCollectionSmsCandidates({
    event,
    options,
    userinfo,
  });

  return useResponseSuccess({
    items,
    options,
    summary: buildAmountBillCollectionSmsSummary(items),
  });
});
