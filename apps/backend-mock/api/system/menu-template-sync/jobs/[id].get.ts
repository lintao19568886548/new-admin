import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { canManageMenuTemplateSync } from '~/utils/menu-template-sync';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type MenuTemplateSyncLogRow = {
  createTime: Date | null;
  details: unknown;
  errorMessage: null | string;
  id: number;
  status: string;
  summary: unknown;
  targetCustomerId: string;
  targetDbName: null | string;
};

function normalizeDate(value: Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  if (!canManageMenuTemplateSync(userinfo)) {
    return forbiddenResponse(event);
  }

  const jobId = Number(event.context.params?.id);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return badRequestResponse('job id is required', event);
  }

  try {
    const logs = await systemDbClient.$queryRawUnsafe<MenuTemplateSyncLogRow[]>(
      `
        SELECT
          id,
          target_customer_id AS targetCustomerId,
          target_db_name AS targetDbName,
          status,
          summary,
          details,
          error_message AS errorMessage,
          create_time AS createTime
        FROM menu_template_sync_log
        WHERE job_id = ${jobId}
        ORDER BY id ASC
      `,
    );

    return useResponseSuccess(
      logs.map((row) => ({
        ...row,
        createTime: normalizeDate(row.createTime),
      })),
    );
  } catch (error) {
    return serverErrorResponse(
      error instanceof Error ? error.message : String(error),
      event,
    );
  }
});
