import QRCode from 'qrcode';
import {
  CrmScmError,
  normalizeCrmScene,
  serializeCrmSalesChannel,
} from '~/utils/crm-scrm';
import { systemDbClient } from '~/utils/db';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';

function normalizeOrigin(value: string) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  try {
    const url = new URL(text);
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function buildInviteOrigin(event: any) {
  const configured = normalizeOrigin(
    String(process.env.CRM_INVITE_H5_BASE_URL || '').trim(),
  );
  if (configured) {
    return configured;
  }
  return getRequestURL(event).origin.replace(/\/+$/, '');
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  try {
    const scene = normalizeCrmScene(query.scene);
    const channel = await systemDbClient.crmSalesChannel.findUnique({
      where: { scene },
    });

    if (!channel || Number(channel.status ?? 1) !== 1) {
      return badRequestResponse('二维码渠道不存在或已停用', event, 404);
    }

    const inviteUrl = `${buildInviteOrigin(event)}/invite/crm?scene=${encodeURIComponent(scene)}`;
    const width = Math.min(1280, Math.max(180, Number(query.width) || 430));
    const dataUrl = await QRCode.toDataURL(inviteUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width,
    });

    return useResponseSuccess({
      channel: serializeCrmSalesChannel(channel),
      inviteUrl,
      qrcode: {
        dataUrl,
        mimeType: 'image/png',
      },
      scene,
    });
  } catch (error) {
    if (error instanceof CrmScmError) {
      return error.statusCode >= 500
        ? serverErrorResponse(error.message, event, error.statusCode)
        : badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('[crm] create public invite h5 qrcode failed:', error);
    return serverErrorResponse('生成获客链接二维码失败', event);
  }
});
