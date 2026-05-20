import { getQuery, setResponseStatus } from 'h3';
import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

type KeyJsonValue =
  | boolean
  | KeyJsonValue[]
  | null
  | number
  | string
  | { [key: string]: KeyJsonValue };

const INTERNAL_ONLY_KEYS = new Set(['ALIYUN_BAILIAN_KEY']);

function normalizeKeyValue(raw: unknown): KeyJsonValue {
  if (raw === undefined || raw === null) {
    throw new Error('empty');
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error('empty');
    }
    return trimmed;
  }

  if (
    Array.isArray(raw) ||
    typeof raw === 'boolean' ||
    typeof raw === 'number' ||
    typeof raw === 'object'
  ) {
    return raw as KeyJsonValue;
  }

  throw new Error('invalid');
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const { key } = getQuery(event);
  const keyName = typeof key === 'string' ? key.trim() : '';

  if (!keyName) {
    return badRequestResponse('参数 key 不能为空', event);
  }

  if (INTERNAL_ONLY_KEYS.has(keyName)) {
    return forbiddenResponse(event, `key is internal only: ${keyName}`);
  }

  const record = await systemDbClient.systemKey.findUnique({
    where: {
      key: keyName,
    },
  });

  if (!record) {
    setResponseStatus(event, 404);
    return useResponseError(`系统配置未找到或为空: ${keyName}`, null, 404);
  }

  let value: KeyJsonValue;
  try {
    value = normalizeKeyValue(record.value);
  } catch {
    setResponseStatus(event, 404);
    return useResponseError(`系统配置未找到或为空: ${keyName}`, null, 404);
  }

  return useResponseSuccess({
    key: record.key,
    value,
  });
});
