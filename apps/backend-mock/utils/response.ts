import type { EventHandlerRequest, H3Event } from 'h3';

export function useResponseSuccess<T = any>(data: T, message: string = 'ok') {
  return {
    code: 0,
    data,
    error: null,
    message,
  };
}

export function usePageResponseSuccess<T = any>(
  page: number | string,
  pageSize: number | string,
  list: T[],
  { message = 'ok' } = {},
) {
  const pageData = pagination(
    Number.parseInt(`${page}`),
    Number.parseInt(`${pageSize}`),
    list,
  );

  return {
    ...useResponseSuccess({
      items: pageData,
      total: list.length,
    }),
    message,
  };
}

export function useResponseError(
  message: string,
  error: any = null,
  code?: number,
) {
  return {
    code,
    data: null,
    error,
    message,
  };
}

export function serverErrorResponse(
  message: string,
  event: H3Event<EventHandlerRequest>,
  code = 500,
) {
  setResponseStatus(event, code);
  return useResponseError(message, message, code);
}

export function forbiddenResponse(
  event: H3Event<EventHandlerRequest>,
  message = 'Forbidden Exception',
) {
  setResponseStatus(event, 403);
  return useResponseError(message, message);
}

export function unAuthorizedResponse(
  event: H3Event<EventHandlerRequest>,
  message = '验证失败',
  errorCode?: string,
) {
  setResponseStatus(event, 401);
  return {
    ...useResponseError(message, message, 401),
    ...(errorCode ? { errorCode } : null),
  };
}

export function badRequestResponse(
  message: string,
  event: H3Event<EventHandlerRequest>,
  code = 400,
) {
  setResponseStatus(event, code);
  return useResponseError(message, message, code);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pagination<T = any>(
  pageNo: number,
  pageSize: number,
  array: T[],
): T[] {
  const offset = (pageNo - 1) * Number(pageSize);
  return offset + Number(pageSize) >= array.length
    ? array.slice(offset)
    : array.slice(offset, offset + Number(pageSize));
}
