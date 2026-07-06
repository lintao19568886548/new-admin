import type { Prisma } from '@prisma/.prisma/client/index.js';

import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import { getAuthorizedParkIds } from '../utils';

type RepairOrderWorkflowAction =
  | 'accept'
  | 'cancel'
  | 'finish'
  | 'return'
  | 'verify';

const ACTION_STATUS_MAP: Record<
  RepairOrderWorkflowAction,
  { from: string[]; nextStatus: string }
> = {
  accept: { from: ['待接单'], nextStatus: '处理中' },
  cancel: { from: ['待接单', '处理中', '待验收'], nextStatus: '已取消' },
  finish: { from: ['处理中'], nextStatus: '待验收' },
  return: { from: ['待验收'], nextStatus: '处理中' },
  verify: { from: ['待验收'], nextStatus: '已完成' },
};

function getOperatorName(userinfo: any) {
  return String(userinfo?.realName || userinfo?.username || '').trim();
}

function getOperatorPhone(userinfo: any) {
  return String(userinfo?.phone || userinfo?.phoneNumber || '').trim();
}

function appendRemark(
  current: null | string | undefined,
  label: string,
  remark?: string,
) {
  const text = String(remark || '').trim();
  if (!text) {
    return current ?? undefined;
  }

  const nextLine = `${label}：${text}`;
  return current ? `${current}\n${nextLine}` : nextLine;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const repairOrderId = Number(event.context.params?.id);
    if (!Number.isInteger(repairOrderId) || repairOrderId <= 0) {
      return useResponseError('repairOrderId 错误');
    }

    const body = (await readBody(event)) || {};
    const action = String(
      body.action || '',
    ).trim() as RepairOrderWorkflowAction;
    const actionConfig = ACTION_STATUS_MAP[action];
    if (!actionConfig) {
      return useResponseError('工单处理动作无效');
    }

    const existed = await prismaClient.repairOrder.findUnique({
      where: { repairOrderId },
    });
    if (!existed) {
      return useResponseError('报修工单不存在');
    }

    const authorizedParkIds = getAuthorizedParkIds(userinfo);
    if (!authorizedParkIds.includes(existed.parkId)) {
      return useResponseError('没有操作权限');
    }

    if (!actionConfig.from.includes(existed.status)) {
      return useResponseError(
        `当前状态为${existed.status}，不能执行该处理动作`,
      );
    }

    const now = new Date();
    const operatorName = getOperatorName(userinfo);
    const operatorPhone = getOperatorPhone(userinfo);
    const remark = String(body.remark || '').trim();
    const data: Prisma.RepairOrderUncheckedUpdateInput = {
      status: actionConfig.nextStatus,
    };

    if (action === 'accept') {
      data.acceptTime = now;
      data.assignee = existed.assignee || operatorName || undefined;
      data.assigneePhone = existed.assigneePhone || operatorPhone || undefined;
    }

    if (action === 'finish') {
      data.finishTime = now;
      data.processRemark =
        appendRemark(
          existed.processRemark,
          '完工说明',
          remark || '维修处理完成，提交验收',
        ) ?? undefined;
    }

    if (action === 'verify') {
      data.confirmTime = now;
      data.processRemark =
        appendRemark(existed.processRemark, '验收说明', remark) ?? undefined;
    }

    if (action === 'return') {
      data.finishTime = null;
      data.processRemark =
        appendRemark(existed.processRemark, '验收退回', remark) ?? undefined;
    }

    if (action === 'cancel') {
      data.processRemark =
        appendRemark(existed.processRemark, '取消原因', remark) ?? undefined;
    }

    const result = await prismaClient.repairOrder.update({
      data,
      where: { repairOrderId },
    });

    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('报修工单处理失败:', error);
    return serverErrorResponse(error.message || '报修工单处理失败', event);
  }
});
