import { updatePropertyTags } from '~/utils/investment-radar/property-tag-service';
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

  const factoryId = Number(event.context.params?.id);
  if (!Number.isFinite(factoryId) || factoryId <= 0) {
    return badRequestResponse('propertyId 无效', event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;

  try {
    const result = await runWithRadarSharedScope(() =>
      updatePropertyTags({
        actorId: Number((userinfo as any).userId || (userinfo as any).id || 0),
        factoryId,
        tags: body.tags ?? body.tagsJson ?? [],
      }),
    );
    if (!result) {
      return badRequestResponse('房源不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    console.error('update property tags failed:', error);
    return serverErrorResponse('更新房源标签失败', event);
  }
});
