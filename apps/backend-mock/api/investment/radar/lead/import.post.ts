import { importRadarLeadsFromItems } from '~/utils/investment-radar/radar-lead-import-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as
    | Record<string, unknown>
    | Record<string, unknown>[];
  const items = Array.isArray(body) ? body : body.items;
  if (!Array.isArray(items)) {
    return badRequestResponse('导入内容必须是数组或 { items: [] }', event);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      importRadarLeadsFromItems(items as Record<string, unknown>[]),
    );
    return useResponseSuccess(result);
  } catch (error) {
    console.error('import radar leads failed:', error);
    return serverErrorResponse('导入智能招商潜客失败', event);
  }
});
