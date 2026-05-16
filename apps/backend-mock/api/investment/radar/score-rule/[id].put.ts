import {
  LeadScoreRuleValidationError,
  updateLeadScoreRule,
} from '~/utils/investment-radar/score-rule-repository';
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

  const ruleId = Number(event.context.params?.id);
  if (!Number.isFinite(ruleId) || ruleId <= 0) {
    return badRequestResponse('ruleId 无效', event);
  }

  const body = ((await readBody(event).catch(() => ({}))) || {}) as Record<
    string,
    unknown
  >;
  let keywordJson: null | string[] | undefined;
  if (body.keywordJson === undefined) {
    keywordJson = undefined;
  } else if (body.keywordJson === null) {
    keywordJson = null;
  } else {
    keywordJson = body.keywordJson as string[];
  }

  let ruleDescription: null | string | undefined;
  if (body.ruleDescription === undefined) {
    ruleDescription = undefined;
  } else if (body.ruleDescription === null) {
    ruleDescription = null;
  } else {
    ruleDescription = String(body.ruleDescription);
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      updateLeadScoreRule(ruleId, {
        enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
        keywordJson,
        ruleDescription,
        scoreDelta:
          body.scoreDelta === undefined ? undefined : Number(body.scoreDelta),
      }),
    );
    if (!result) {
      return badRequestResponse('评分规则不存在', event, 404);
    }
    return useResponseSuccess(result);
  } catch (error) {
    if (error instanceof LeadScoreRuleValidationError) {
      return badRequestResponse(error.message, event);
    }
    console.error('update lead score rule failed:', error);
    return serverErrorResponse('更新评分规则失败', event);
  }
});
