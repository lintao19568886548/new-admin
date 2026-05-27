import { systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { canManageMenuTemplateSync } from '~/utils/menu-template-sync';
import {
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type MenuTemplateSyncJobRow = {
  completedAt: Date | null;
  createTime: Date | null;
  errorMessage: null | string;
  id: number;
  mode: string;
  sourceCustomerId: string;
  status: string;
  summary: unknown;
  targetCustomerId: null | string;
  targetScope: string;
};

function normalizeDate(value: Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeLimit(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const limit = Number(raw || 20);
  if (!Number.isFinite(limit)) {
    return 20;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  if (!canManageMenuTemplateSync(userinfo)) {
    return forbiddenResponse(event);
  }

  const query = getQuery(event);
  const limit = normalizeLimit(query.limit);

  try {
    const rows = await systemDbClient.$queryRawUnsafe<MenuTemplateSyncJobRow[]>(
      `
        SELECT
          id,
          mode,
          source_customer_id AS sourceCustomerId,
          target_scope AS targetScope,
          target_customer_id AS targetCustomerId,
          status,
          summary,
          error_message AS errorMessage,
          completed_at AS completedAt,
          create_time AS createTime
        FROM menu_template_sync_job
        ORDER BY id DESC
        LIMIT ${limit}
      `,
    );

    return useResponseSuccess(
      rows.map((row) => ({
        ...row,
        completedAt: normalizeDate(row.completedAt),
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
