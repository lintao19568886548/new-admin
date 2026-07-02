import type { AgentRiskLevel } from './types';

import { writeAgentAuditLog } from './task-repository';

export async function auditAgentAction(params: {
  actionType: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  riskLevel?: AgentRiskLevel;
  stepId?: string;
  targetId?: string;
  targetType?: string;
  taskId?: string;
  userAgent?: string;
  userId?: number;
}) {
  return writeAgentAuditLog(params);
}
