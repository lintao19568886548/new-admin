import type { AgentContext, SkillDefinition } from './types';

export class AgentPermissionError extends Error {
  constructor(message = '没有权限执行该 Agent Skill') {
    super(message);
    this.name = 'AgentPermissionError';
  }
}

export function assertAgentSkillPermission(
  context: AgentContext,
  skill: SkillDefinition,
) {
  if (!skill.permissionCode) {
    return;
  }

  const codes = Array.isArray(context.userinfo.codes)
    ? context.userinfo.codes
    : [];
  if (!codes.includes(skill.permissionCode)) {
    throw new AgentPermissionError();
  }
}

export function resolveContextParkId(context: AgentContext) {
  const parkId =
    context.parkId ||
    context.userinfo.parks
      ?.map((park) => Number(park.parkId))
      .find((item) => Number.isInteger(item) && item > 0);
  return Number.isInteger(parkId) && parkId > 0 ? parkId : undefined;
}
