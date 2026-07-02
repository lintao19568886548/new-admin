import type {
  AgentRiskLevel,
  AgentTaskRecord,
  AgentTaskStatus,
  AgentTaskStepRecord,
  AgentTaskStepStatus,
  ExecutionPlan,
  RunAgentTaskInput,
} from './types';

import { randomUUID } from 'node:crypto';

import { prismaClient } from '~/utils/db';

import { sanitizeForAgentLog } from './sensitive';

const AGENT_TABLE_MISSING_CODES = new Set(['42S02', 'P2010']);

export class AgentSchemaNotReadyError extends Error {
  constructor(
    message = 'Agent 数据表未创建，请先由用户确认后手动执行 Prisma db push',
  ) {
    super(message);
    this.name = 'AgentSchemaNotReadyError';
  }
}

function isAgentSchemaNotReadyError(error: any) {
  const code = String(error?.code || error?.meta?.code || '');
  const message = String(error?.message || error?.meta?.message || '');
  return (
    AGENT_TABLE_MISSING_CODES.has(code) ||
    message.includes("doesn't exist") ||
    message.includes('agent_task') ||
    message.includes('agent_task_step') ||
    message.includes('agent_audit_log')
  );
}

function rethrowAgentRepositoryError(error: unknown): never {
  if (isAgentSchemaNotReadyError(error)) {
    throw new AgentSchemaNotReadyError();
  }
  throw error;
}

function toNullableIso(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseJsonObject(value: unknown): null | Record<string, unknown> {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeTaskRow(row: any): AgentTaskRecord {
  return {
    agentCode: String(row.agentCode || row.agent_code || ''),
    createTime: toNullableIso(row.createTime || row.create_time) || '',
    currentStepNo:
      row.currentStepNo === null || row.current_step_no === null
        ? null
        : Number(row.currentStepNo ?? row.current_step_no ?? 0) || null,
    errorMessage: row.errorMessage ?? row.error_message ?? null,
    finishedAt: toNullableIso(row.finishedAt || row.finished_at),
    id: String(row.id || ''),
    input: parseJsonObject(row.input) || {},
    organizationId:
      row.organizationId === null || row.organization_id === null
        ? null
        : Number(row.organizationId ?? row.organization_id ?? 0) || null,
    parkId:
      row.parkId === null || row.park_id === null
        ? null
        : Number(row.parkId ?? row.park_id ?? 0) || null,
    plan: parseJsonObject(row.plan),
    result: parseJsonObject(row.result),
    sourceModule: row.sourceModule ?? row.source_module ?? null,
    sourcePage: row.sourcePage ?? row.source_page ?? null,
    sourceRecordId: row.sourceRecordId ?? row.source_record_id ?? null,
    startedAt: toNullableIso(row.startedAt || row.started_at),
    status: String(row.status || 'pending') as AgentTaskStatus,
    updateTime: toNullableIso(row.updateTime || row.update_time) || '',
    userId: Number(row.userId ?? row.user_id ?? 0),
  };
}

function normalizeStepRow(row: any): AgentTaskStepRecord {
  return {
    approvalId: row.approvalId ?? row.approval_id ?? null,
    createTime: toNullableIso(row.createTime || row.create_time) || '',
    durationMs:
      row.durationMs === null || row.duration_ms === null
        ? null
        : Number(row.durationMs ?? row.duration_ms ?? 0) || null,
    errorMessage: row.errorMessage ?? row.error_message ?? null,
    finishedAt: toNullableIso(row.finishedAt || row.finished_at),
    id: String(row.id || ''),
    input: parseJsonObject(row.input),
    output: parseJsonObject(row.output),
    requiresApproval: Boolean(
      row.requiresApproval ?? row.requires_approval ?? false,
    ),
    riskLevel: String(
      row.riskLevel || row.risk_level || 'low',
    ) as AgentRiskLevel,
    skillName: row.skillName ?? row.skill_name ?? null,
    startedAt: toNullableIso(row.startedAt || row.started_at),
    status: String(row.status || 'pending') as AgentTaskStepStatus,
    stepName: String(row.stepName || row.step_name || ''),
    stepNo: Number(row.stepNo ?? row.step_no ?? 0),
    taskId: String(row.taskId || row.task_id || ''),
    updateTime: toNullableIso(row.updateTime || row.update_time) || '',
  };
}

function jsonParam(value: unknown) {
  return JSON.stringify(sanitizeForAgentLog(value ?? {}));
}

export function createAgentId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export async function createAgentTask(params: {
  context: {
    organizationId?: number;
    parkId?: number;
    userId: number;
  };
  request: RunAgentTaskInput;
}) {
  const id = createAgentId('agt');
  try {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO agent_task (
          id, agent_code, source_module, source_page, source_record_id,
          user_id, organization_id, park_id, input, status, started_at,
          create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', NOW(), NOW(), NOW())
      `,
      id,
      params.request.agentCode,
      params.request.sourceModule || null,
      params.request.sourcePage || null,
      params.request.sourceRecordId || null,
      params.context.userId,
      params.context.organizationId || null,
      params.context.parkId || null,
      jsonParam(params.request.input),
    );
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
  return id;
}

export async function updateAgentTaskPlan(params: {
  plan: ExecutionPlan;
  taskId: string;
}) {
  try {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE agent_task
        SET plan = ?, update_time = NOW()
        WHERE id = ?
      `,
      jsonParam(params.plan),
      params.taskId,
    );
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
}

export async function finishAgentTask(params: {
  errorMessage?: string;
  result?: Record<string, unknown>;
  status: AgentTaskStatus;
  taskId: string;
}) {
  try {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE agent_task
        SET status = ?, result = ?, error_message = ?, finished_at = NOW(), update_time = NOW()
        WHERE id = ?
      `,
      params.status,
      jsonParam(params.result || {}),
      params.errorMessage || null,
      params.taskId,
    );
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
}

export async function createAgentTaskStep(params: {
  input?: Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: AgentRiskLevel;
  skillName?: string;
  stepName: string;
  stepNo: number;
  taskId: string;
}) {
  const id = createAgentId('ags');
  try {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO agent_task_step (
          id, task_id, step_no, step_name, skill_name, input, status,
          risk_level, requires_approval, started_at, create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, NOW(), NOW(), NOW())
      `,
      id,
      params.taskId,
      params.stepNo,
      params.stepName,
      params.skillName || null,
      jsonParam(params.input || {}),
      params.riskLevel,
      params.requiresApproval ? 1 : 0,
    );
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE agent_task
        SET current_step_no = ?, update_time = NOW()
        WHERE id = ?
      `,
      params.stepNo,
      params.taskId,
    );
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
  return id;
}

export async function finishAgentTaskStep(params: {
  durationMs?: number;
  errorMessage?: string;
  output?: Record<string, unknown>;
  status: AgentTaskStepStatus;
  stepId: string;
}) {
  try {
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE agent_task_step
        SET output = ?, status = ?, error_message = ?, duration_ms = ?,
            finished_at = NOW(), update_time = NOW()
        WHERE id = ?
      `,
      jsonParam(params.output || {}),
      params.status,
      params.errorMessage || null,
      params.durationMs || null,
      params.stepId,
    );
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
}

export async function writeAgentAuditLog(params: {
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
  const id = createAgentId('aga');
  try {
    await prismaClient.$executeRawUnsafe(
      `
        INSERT INTO agent_audit_log (
          id, task_id, step_id, user_id, action_type, target_type, target_id,
          risk_level, input, output, user_agent, create_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      id,
      params.taskId || null,
      params.stepId || null,
      params.userId || null,
      params.actionType,
      params.targetType || null,
      params.targetId || null,
      params.riskLevel || 'low',
      jsonParam(params.input || {}),
      jsonParam(params.output || {}),
      params.userAgent || null,
    );
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
  return id;
}

export async function listAgentTasks(params: {
  page: number;
  pageSize: number;
  status?: string;
  userId: number;
}) {
  const safePage = Math.max(Math.floor(params.page || 1), 1);
  const safePageSize = Math.min(
    Math.max(Math.floor(params.pageSize || 20), 1),
    100,
  );
  const offset = (safePage - 1) * safePageSize;
  const whereParts = ['user_id = ?'];
  const values: unknown[] = [params.userId];
  if (params.status) {
    whereParts.push('status = ?');
    values.push(params.status);
  }
  const whereSql = whereParts.join(' AND ');

  try {
    const totalRows = await prismaClient.$queryRawUnsafe<
      Array<{ total: bigint | number }>
    >(`SELECT COUNT(*) AS total FROM agent_task WHERE ${whereSql}`, ...values);
    const rows = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT *
        FROM agent_task
        WHERE ${whereSql}
        ORDER BY create_time DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      safePageSize,
      offset,
    );
    return {
      items: rows.map((row) => normalizeTaskRow(row)),
      total: Number(totalRows[0]?.total || 0),
    };
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
}

export async function getAgentTaskDetail(params: {
  taskId: string;
  userId: number;
}) {
  try {
    const taskRows = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT *
        FROM agent_task
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `,
      params.taskId,
      params.userId,
    );
    const task = taskRows[0] ? normalizeTaskRow(taskRows[0]) : null;
    if (!task) {
      return null;
    }
    const stepRows = await prismaClient.$queryRawUnsafe<any[]>(
      `
        SELECT *
        FROM agent_task_step
        WHERE task_id = ?
        ORDER BY step_no ASC
      `,
      params.taskId,
    );
    return {
      steps: stepRows.map((row) => normalizeStepRow(row)),
      task,
    };
  } catch (error) {
    rethrowAgentRepositoryError(error);
  }
}
