const RETRY_BRIDGE_REQ_ID_KEY = '__retryBridgeReqId';
const MAX_RETRY_PAYLOAD_CACHE_SIZE = 30;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

function getRequestId(config: Record<string, unknown>) {
  const requestId = Number(config[RETRY_BRIDGE_REQ_ID_KEY]);
  return Number.isFinite(requestId) && requestId > 0 ? requestId : null;
}

function isRetryConfig(config: Record<string, unknown>) {
  return config.__isRetryRequest === true;
}

function isAxiosRequestConfigLike(
  value: unknown,
): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  return (
    Object.hasOwn(value, 'url') &&
    Object.hasOwn(value, 'method') &&
    Object.hasOwn(value, 'headers')
  );
}

function extractPayloadFromResponse(response: unknown) {
  if (!isObject(response)) return undefined;
  const raw = response.data;
  return isObject(raw) && Object.hasOwn(raw, 'data')
    ? (raw as Record<string, unknown>).data
    : raw;
}

export function createRetryResponseBridge() {
  let requestSeq = 0;
  const retryPayloadCache = new Map<number, unknown>();

  function attachRequestId(config: unknown) {
    if (!isObject(config)) return;
    if (getRequestId(config)) return;
    requestSeq += 1;
    config[RETRY_BRIDGE_REQ_ID_KEY] = requestSeq;
  }

  function cacheRetryPayload(requestId: number, payload: unknown) {
    retryPayloadCache.set(requestId, payload);
    if (retryPayloadCache.size > MAX_RETRY_PAYLOAD_CACHE_SIZE) {
      retryPayloadCache.delete(retryPayloadCache.keys().next().value as number);
    }
  }

  function captureRetryResponse(response: any): any {
    const config = isObject(response) ? (response.config as unknown) : null;
    if (!isObject(config) || !isRetryConfig(config)) {
      return response;
    }
    const requestId = getRequestId(config);
    if (!requestId) return response;

    cacheRetryPayload(requestId, extractPayloadFromResponse(response));
    return response;
  }

  function restoreRetryPayload(payload: any): any {
    if (!isAxiosRequestConfigLike(payload) || !isRetryConfig(payload)) {
      return payload;
    }
    const requestId = getRequestId(payload);
    if (!requestId || !retryPayloadCache.has(requestId)) {
      return payload;
    }
    const cached = retryPayloadCache.get(requestId);
    retryPayloadCache.delete(requestId);
    return cached;
  }

  return {
    attachRequestId,
    captureRetryResponse,
    restoreRetryPayload,
  };
}
