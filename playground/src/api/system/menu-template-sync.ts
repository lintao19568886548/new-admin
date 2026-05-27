import { requestClient } from '#/api/request';

export namespace MenuTemplateSyncApi {
  export type TargetScope = 'allTenants' | 'public' | 'tenant';

  export interface RunParams {
    allTenants?: boolean;
    targetCustomerId?: string;
  }

  export interface SummaryGroup {
    adopt?: number;
    conflict?: number;
    create?: number;
    disable?: number;
    parentChanged?: number;
    update?: number;
  }

  export interface TargetResult {
    details?: Record<string, any>;
    errorMessage?: string;
    execution?: Record<string, any>;
    permissionCache?: Record<string, any>;
    status: string;
    summary?: {
      code?: SummaryGroup;
      menu?: SummaryGroup;
    };
    targetCustomerId: string;
    targetDbName?: string;
  }

  export interface RunResult {
    dryRun: boolean;
    executed?: boolean;
    jobId?: number;
    mode: 'dry_run' | 'execute';
    preflight?: {
      blocked: number;
      ready: number;
      targets: number;
    };
    redis?: {
      required: boolean;
      url: null | string;
    };
    source?: {
      customerId: string;
      databaseUrl: string;
      publishSet: {
        code: number;
        menu: number;
      };
    };
    status: string;
    summary?: Record<string, any>;
    targets: TargetResult[];
  }

  export interface Job {
    completedAt?: null | string;
    createTime?: null | string;
    errorMessage?: null | string;
    id: number;
    mode: string;
    sourceCustomerId: string;
    status: string;
    summary?: Record<string, any>;
    targetCustomerId?: null | string;
    targetScope: string;
  }

  export interface JobLog {
    createTime?: null | string;
    details?: Record<string, any>;
    errorMessage?: null | string;
    id: number;
    status: string;
    summary?: Record<string, any>;
    targetCustomerId: string;
    targetDbName?: null | string;
  }
}

export function dryRunMenuTemplateSync(params: MenuTemplateSyncApi.RunParams) {
  return requestClient.post<MenuTemplateSyncApi.RunResult>(
    '/system/menu-template-sync/dry-run',
    params,
  );
}

export function executeMenuTemplateSync(params: MenuTemplateSyncApi.RunParams) {
  return requestClient.post<MenuTemplateSyncApi.RunResult>(
    '/system/menu-template-sync/execute',
    params,
  );
}

export function getMenuTemplateSyncJobs(limit = 20) {
  return requestClient.get<MenuTemplateSyncApi.Job[]>(
    '/system/menu-template-sync/jobs',
    {
      params: { limit },
    },
  );
}

export function getMenuTemplateSyncJobLogs(jobId: number) {
  return requestClient.get<MenuTemplateSyncApi.JobLog[]>(
    `/system/menu-template-sync/jobs/${jobId}`,
  );
}
