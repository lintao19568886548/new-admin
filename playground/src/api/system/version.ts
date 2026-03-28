import { requestClient } from '#/api/request';

export interface VersionInfo {
  androidUrl: string;
  iosUrl?: string;
  notes: string;
  version: string;
}

export function getLatestVersionApi() {
  return requestClient.get<VersionInfo>('/system/version');
}
