import { requestClient } from '#/api/request';

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonObject | JsonPrimitive | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface SystemKeyValue<T = JsonValue> {
  key: string;
  value: T;
}

export async function getSystemKeyApi<T = JsonValue>(key: string) {
  return requestClient.get<SystemKeyValue<T>>('/system/key', {
    params: { key },
  });
}
