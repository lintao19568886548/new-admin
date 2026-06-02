import { prismaClient } from '~/utils/db';

import { checkContactRestriction } from './contact-restriction-service';
import { ensureOutreachTaskTable } from './outreach-action-service';
import { deliverOutreachMessage } from './outreach-channel-service';
import { fillOutreachTemplateContent } from './outreach-template-service';

export interface SendOutreachTaskResult {
  providerTaskId?: null | string;
  resultCode: string;
  resultMessage: string;
  sentAt?: null | string;
  sentBy?: null | number;
  status: string;
  taskId: number;
}

interface OutreachTaskDeliveryRow {
  channel?: null | string;
  companyName?: null | string;
  contactName?: null | string;
  content?: null | string;
  enterpriseId?: null | number;
  intentArea?: null | number;
  leadId?: null | number;
  parkName?: null | string;
  phoneNumber?: null | string;
  resultMessage?: null | string;
  status?: null | string;
  taskId?: null | number;
  taskType?: null | string;
  templateCode?: null | string;
  templateContent?: null | string;
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function formatIntentArea(value: unknown) {
  const area = Number(value || 0);
  return area > 0 ? `${area.toLocaleString('zh-CN')}m²` : '待确认面积';
}

function safeProviderResponseJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ raw: String(value) });
  }
}

function buildTaskContent(task: OutreachTaskDeliveryRow) {
  const existingContent =
    normalizeText(task.content) || normalizeText(task.resultMessage);
  if (existingContent) {
    return existingContent;
  }

  const templateContent = normalizeText(task.templateContent);
  if (!templateContent) {
    return '';
  }

  return fillOutreachTemplateContent(templateContent, {
    companyName: normalizeText(task.companyName) || '该企业',
    contactName: normalizeText(task.contactName) || '客户',
    intentArea: formatIntentArea(task.intentArea),
    parkName: normalizeText(task.parkName) || '园区',
  });
}

async function getTaskForDelivery(taskId: number) {
  const rows = await prismaClient.$queryRawUnsafe<OutreachTaskDeliveryRow[]>(
    `
      SELECT
        t.task_id AS taskId,
        t.lead_id AS leadId,
        t.task_type AS taskType,
        t.channel,
        t.phone_number AS phoneNumber,
        t.status,
        t.template_code AS templateCode,
        t.content AS content,
        t.result_message AS resultMessage,
        l.enterprise_id AS enterpriseId,
        l.intent_area AS intentArea,
        COALESCE(e.enterprise_name, '该企业') AS companyName,
        e.contact_name AS contactName,
        COALESCE(p.park_name, '园区') AS parkName,
        tpl.content AS templateContent
      FROM investment_outreach_task t
      INNER JOIN investment_lead l ON l.lead_id = t.lead_id
      LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
      LEFT JOIN park p ON p.park_id = l.park_id
      LEFT JOIN investment_outreach_template tpl
        ON tpl.template_code COLLATE utf8mb4_unicode_ci =
          t.template_code COLLATE utf8mb4_unicode_ci
      WHERE t.task_id = ?
        AND l.is_deleted = 0
      LIMIT 1
    `,
    taskId,
  );

  return rows[0] || null;
}

async function cancelRestrictedTask(taskId: number, resultMessage: string) {
  await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_outreach_task
      SET
        status = 'CANCELED',
        result_code = 'CONTACT_RESTRICTED',
        result_message = ?,
        update_time = NOW(3)
      WHERE task_id = ?
    `,
    resultMessage,
    taskId,
  );

  return {
    resultCode: 'CONTACT_RESTRICTED',
    resultMessage,
    sentAt: null,
    sentBy: null,
    status: 'CANCELED',
    taskId,
  } satisfies SendOutreachTaskResult;
}

export async function sendOutreachTask(
  taskId: number,
  operatorUserId: number,
): Promise<SendOutreachTaskResult> {
  await ensureOutreachTaskTable();

  const task = await getTaskForDelivery(taskId);
  if (!task) {
    throw new Error('触达任务不存在');
  }

  const taskStatus = normalizeText(task.status);
  if (!['PENDING', 'RUNNING'].includes(taskStatus)) {
    throw new Error('当前任务状态不允许发送');
  }

  const leadId = Number(task.leadId || 0);
  const restriction = await checkContactRestriction({
    enterpriseId: Number(task.enterpriseId || 0) || null,
    leadId: leadId || null,
    phoneNumber: task.phoneNumber || null,
  });
  if (!restriction.canContact) {
    return cancelRestrictedTask(
      taskId,
      restriction.reason || '当前联系人不建议触达',
    );
  }

  const content = buildTaskContent(task);
  if (!content) {
    throw new Error('触达内容为空，无法发送');
  }

  await prismaClient.$executeRawUnsafe(
    `
      UPDATE investment_outreach_task
      SET
        status = 'RUNNING',
        content = ?,
        sent_by = ?,
        update_time = NOW(3)
      WHERE task_id = ?
    `,
    content,
    operatorUserId,
    taskId,
  );

  try {
    const deliveryResult = await deliverOutreachMessage({
      channel: normalizeText(task.channel) || 'SMS',
      companyName: task.companyName,
      contactName: task.contactName,
      content,
      leadId,
      phoneNumber: task.phoneNumber,
      subject: `招商触达：${normalizeText(task.companyName) || '客户'}`,
      taskId,
      templateCode: task.templateCode,
    });

    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_outreach_task
        SET
          status = 'SENT',
          sent_at = NOW(3),
          sent_by = ?,
          result_code = ?,
          result_message = ?,
          provider_task_id = ?,
          provider_response_json = ?,
          update_time = NOW(3)
        WHERE task_id = ?
      `,
      operatorUserId,
      deliveryResult.resultCode,
      deliveryResult.resultMessage,
      deliveryResult.providerTaskId || null,
      safeProviderResponseJson(deliveryResult.providerResponse),
      taskId,
    );

    if (leadId > 0) {
      await prismaClient.$executeRawUnsafe(
        `
          UPDATE investment_lead
          SET
            latest_contact_time = NOW(3),
            stage = CASE
              WHEN stage = 'PENDING_CONTACT' THEN 'CONTACTED'
              ELSE stage
            END,
            update_time = NOW(3)
          WHERE lead_id = ?
        `,
        leadId,
      );
    }

    return {
      providerTaskId: deliveryResult.providerTaskId || null,
      resultCode: deliveryResult.resultCode,
      resultMessage: deliveryResult.resultMessage,
      sentAt: new Date().toISOString(),
      sentBy: operatorUserId,
      status: 'SENT',
      taskId,
    };
  } catch (error) {
    const resultMessage =
      error instanceof Error ? error.message : '触达发送失败';
    await prismaClient.$executeRawUnsafe(
      `
        UPDATE investment_outreach_task
        SET
          status = 'FAILED',
          result_code = 'SEND_FAILED',
          result_message = ?,
          update_time = NOW(3)
        WHERE task_id = ?
      `,
      resultMessage,
      taskId,
    );

    return {
      resultCode: 'SEND_FAILED',
      resultMessage,
      sentAt: null,
      sentBy: operatorUserId,
      status: 'FAILED',
      taskId,
    };
  }
}
