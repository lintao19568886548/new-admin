import type { H3Event } from 'h3';

import { getQuery } from 'h3';

export const HEADQUARTERS_PARK_ID = -1;

export function normalizeCurrentParkId(value: unknown) {
  const parkId = Number(value);
  if (Number.isInteger(parkId) && parkId >= HEADQUARTERS_PARK_ID) {
    return parkId;
  }
  return HEADQUARTERS_PARK_ID;
}

export function getCurrentParkIdFromEvent(event: H3Event) {
  const query = getQuery(event);
  return normalizeCurrentParkId(
    query.currentPark ?? query.parkId ?? event.context.currentParkId,
  );
}

export function resolveAuthorizedParkIdsForScope(params: {
  authorizedParkIds: number[];
  currentParkId: unknown;
}) {
  const authorizedParkIds = params.authorizedParkIds.filter(
    (parkId) => Number.isInteger(parkId) && parkId > 0,
  );
  const currentParkId = normalizeCurrentParkId(params.currentParkId);

  if (currentParkId === HEADQUARTERS_PARK_ID) {
    return authorizedParkIds;
  }

  return authorizedParkIds.includes(currentParkId) ? [currentParkId] : [];
}
