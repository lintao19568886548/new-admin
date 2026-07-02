import type { SkillDefinition } from './types';

const skills = new Map<string, SkillDefinition>();

export class AgentSkillRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentSkillRegistryError';
  }
}

export function registerSkill(skill: SkillDefinition) {
  if (!skill.name) {
    throw new AgentSkillRegistryError('Skill name is required');
  }
  if (skills.has(skill.name)) {
    throw new AgentSkillRegistryError(
      `Skill already registered: ${skill.name}`,
    );
  }
  skills.set(skill.name, {
    enabled: true,
    ...skill,
  });
}

export function getSkill(name: string) {
  return skills.get(name);
}

export function listSkills() {
  return [...skills.values()].map((skill) => ({
    description: skill.description || '',
    enabled: skill.enabled !== false,
    name: skill.name,
    permissionCode: skill.permissionCode || null,
    requiresApproval: Boolean(skill.requiresApproval),
    riskLevel: skill.riskLevel,
    title: skill.title,
  }));
}

export function clearSkillsForTest() {
  skills.clear();
}
