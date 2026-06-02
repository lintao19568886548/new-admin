import { setResponseHeader } from 'h3';
import { exportContactRestrictions } from '~/utils/investment-radar/contact-restriction-service';
import {
  checkRadarPermission,
  RADAR_PERMISSION_CODES,
} from '~/utils/investment-radar/crawler-permission-service';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const permission = checkRadarPermission(
    userinfo,
    RADAR_PERMISSION_CODES.contactRestrictionRead,
  );
  if (!permission.allowed) {
    return forbiddenResponse(event, permission.message);
  }

  try {
    const query = getQuery(event);
    const result = await runWithRadarSharedScope(async () => {
      return await exportContactRestrictions({
        keyword: String(query.keyword || '').trim(),
        restrictionType: String(query.restrictionType || '').trim(),
        status: String(query.status || 'ACTIVE').trim(),
      });
    });

    if (String(query.format || 'rows').toLowerCase() !== 'csv') {
      return useResponseSuccess({
        rows: result.items,
        total: result.total,
      });
    }

    const header = [
      'restrictionId',
      'enterpriseName',
      'contactName',
      'phoneNumber',
      'restrictionType',
      'status',
      'reason',
      'releaseStatus',
      'releaseReason',
      'createTime',
      'updateTime',
    ];
    const lines = [
      header.join(','),
      ...result.items.map((item) =>
        header
          .map((key) =>
            csvCell((item as unknown as Record<string, unknown>)[key]),
          )
          .join(','),
      ),
    ];
    setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8');
    setResponseHeader(
      event,
      'content-disposition',
      'attachment; filename="contact-restrictions.csv"',
    );
    return `\uFEFF${lines.join('\n')}`;
  } catch (error) {
    console.error('export contact restrictions failed:', error);
    return serverErrorResponse('导出触达限制名单失败', event);
  }
});
