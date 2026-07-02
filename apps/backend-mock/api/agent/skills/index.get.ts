import { listSkills } from '~/utils/agent/skill-registry';
import { registerBuiltinAgentSkills } from '~/utils/agent/skills';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  registerBuiltinAgentSkills();
  return useResponseSuccess({
    items: listSkills(),
  });
});
