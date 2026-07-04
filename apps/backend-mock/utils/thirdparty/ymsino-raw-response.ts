import type { EventHandlerRequest, H3Event } from 'h3';

import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export type YmsinoEvent = H3Event<EventHandlerRequest>;
export type YmsinoRawResponse = {
  Code?: number | string;
  Date?: unknown;
  Msg?: string;
};

export async function requireYmsinoUser(event: YmsinoEvent) {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  return null;
}

export function requiredYmsinoParam(
  value: unknown,
  name: string,
  event: YmsinoEvent,
) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return {
      error: badRequestResponse(`${name} is required`, event),
      value: '',
    };
  }
  return { error: null, value: normalized };
}

export function optionalYmsinoParam(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

export function ymsinoRawSuccess(response: YmsinoRawResponse) {
  return String(response?.Code ?? '') === '1';
}

export function ymsinoItems(response: YmsinoRawResponse) {
  const items = response?.Date;
  if (Array.isArray(items)) return items;
  return items ? [items] : [];
}

export function ymsinoRawPageResponse(response: YmsinoRawResponse) {
  const items = ymsinoItems(response);
  return useResponseSuccess({
    raw: response,
    items,
    total: items.length,
  });
}

export function ymsinoVendorError(
  response: YmsinoRawResponse,
  event: YmsinoEvent,
  fallback: string,
) {
  const code = response?.Code === undefined ? 'UNKNOWN' : String(response.Code);
  return badRequestResponse(response?.Msg || `${fallback}: ${code}`, event);
}

export function ymsinoServerError(
  error: unknown,
  event: YmsinoEvent,
  fallback: string,
) {
  const message = error instanceof Error ? error.message : String(error);
  return serverErrorResponse(`${fallback}: ${message}`, event);
}

export { badRequestResponse };
