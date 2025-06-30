import { requestClient } from '#/api/request';

interface VersionInfo {
  notes: string;
  url: string;
  version: string;
}

export function getLatestVersionApi() {
  return requestClient.get<VersionInfo>('/system/version');
}
