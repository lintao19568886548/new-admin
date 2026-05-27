import type { UserInfoForToken } from '~/utils/user-service';

type MenuTemplateSyncRunInput = {
  allTenants?: unknown;
  execute?: boolean;
  targetCustomerId?: unknown;
};

export class MenuTemplateSyncRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MenuTemplateSyncRequestError';
  }
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeMenuTemplateSyncRunInput(
  input: MenuTemplateSyncRunInput,
): MenuTemplateSyncRunInput {
  const allTenants = input.allTenants === true;
  const targetCustomerId = normalizeString(input.targetCustomerId);

  if (allTenants && targetCustomerId) {
    throw new MenuTemplateSyncRequestError(
      'allTenants 不能和 targetCustomerId 同时传入',
    );
  }
  if (!allTenants && !targetCustomerId) {
    throw new MenuTemplateSyncRequestError(
      '请指定 targetCustomerId 或 allTenants',
    );
  }

  return {
    allTenants,
    execute: input.execute === true,
    targetCustomerId,
  };
}

function pushOption(argv: string[], name: string, value: unknown) {
  const text = normalizeString(value);
  if (text) {
    argv.push(`${name}=${text}`);
  }
}

export function buildMenuTemplateSyncArgv(input: MenuTemplateSyncRunInput) {
  const normalizedInput = normalizeMenuTemplateSyncRunInput(input);
  const argv: string[] = [];

  if (normalizedInput.allTenants === true) {
    argv.push('--all-tenants');
  } else {
    pushOption(argv, '--target-customer-id', normalizedInput.targetCustomerId);
  }

  if (normalizedInput.execute) {
    argv.push('--execute');
  }

  return argv;
}

export function canManageMenuTemplateSync(userinfo: UserInfoForToken) {
  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  return (
    userinfo.customerId === defaultCustomerId &&
    Array.isArray(userinfo.roles) &&
    userinfo.roles.includes('Super')
  );
}

export async function runMenuTemplateSyncForApi(
  input: MenuTemplateSyncRunInput,
) {
  const module = await import('../scripts/menu-template-sync-dry-run.mjs');
  return await module.runMenuTemplateSync(buildMenuTemplateSyncArgv(input));
}
