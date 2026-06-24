import { requestClient } from '#/api/request';

export interface CrmWxacode {
  dataUrl: string;
  mimeType: string;
}

export interface CrmMiniProgramQrcodePayload {
  envVersion?: string;
  page?: string;
  scene?: string;
  width?: number;
}

export interface CrmMiniProgramQrcodeResponse {
  envVersion: string;
  page: string;
  scene: string;
  wxacode: CrmWxacode;
}

export interface CrmInviteWxacodeResponse extends CrmMiniProgramQrcodeResponse {
  channel: CrmSalesChannel;
}

export interface CrmInviteH5QrcodeResponse {
  channel: CrmSalesChannel;
  inviteUrl: string;
  qrcode: CrmWxacode;
  scene: string;
}

export interface CrmInviteUrlLinkResponse {
  channel: CrmSalesChannel;
  envVersion: string;
  expireInterval: number;
  page: string;
  query: string;
  scene: string;
  urlLink: string;
}

export interface CrmSalesChannel {
  bindingCount: number;
  channelName: string;
  channelType: string;
  createdById: null | number;
  createTime: null | string;
  externalContactCount: number;
  id: number;
  qrCodeUrl: string;
  salesName: string;
  salesUserId: number;
  scanCount: number;
  scene: string;
  status: number;
  updateTime: null | string;
  weworkUserId: string;
}

export interface CrmOwnerBinding {
  createTime: null | string;
  customerName: string;
  externalUserId: string;
  firstChannelId: null | number;
  firstChannelName: string;
  firstScanAt: null | string;
  firstScene: string;
  id: number;
  lastScanAt: null | string;
  openid: string;
  ownerSalesName: string;
  ownerSalesUserId: number;
  ownerUserPhone: string;
  ownerWeworkUserId: string;
  phone: string;
  status: number;
  unionid: string;
  updateTime: null | string;
}

export interface CrmScanLog {
  bindingId: null | number;
  channelId: null | number;
  channelName: string;
  createTime: null | string;
  customerName: string;
  id: number;
  ip: string;
  isFirstBind: boolean;
  openid: string;
  phone: string;
  requestedSalesName: string;
  requestedSalesUserId: null | number;
  resolvedSalesName: string;
  resolvedSalesUserId: null | number;
  scene: string;
  source: string;
  sourceName: string;
  unionid: string;
  userAgent: string;
}

export interface CrmWeworkContactWay {
  configId: string;
  createTime: null | string;
  expiresAt: null | string;
  id: number;
  qrCode: string;
  salesUserId: number;
  state: string;
  status: number;
  updateTime: null | string;
  weworkUserId: string;
}

export interface CrmExternalContactLog {
  bindingId: null | number;
  changeType: string;
  createTime: null | string;
  customerName: string;
  eventType: string;
  externalUserId: string;
  firstChannelName: string;
  firstScene: string;
  id: number;
  openid: string;
  ownerSalesName: string;
  ownerSalesUserId: null | number;
  phone: string;
  rawPayload: null | Record<string, unknown>;
  state: string;
  unionid: string;
  welcomeCode: string;
  weworkUserId: string;
}

export interface CrmConfigStatus {
  callbackUrl: string;
  h5Oauth: {
    appIdConfigured: boolean;
    appSecretConfigured: boolean;
    h5BaseUrlConfigured: boolean;
  };
  inviteH5Url: string;
  miniprogram: {
    appIdConfigured: boolean;
    appSecretConfigured: boolean;
    h5BaseUrlConfigured: boolean;
    qrcodePage: string;
    qrcodePageConfigured: boolean;
  };
  required: Array<{
    configured: boolean;
    key: string;
  }>;
  wework: {
    aesKeyConfigured: boolean;
    callbackTokenConfigured: boolean;
    corpIdConfigured: boolean;
    customerContactSecretConfigured: boolean;
  };
}

export interface CrmOverviewStats {
  bindings: {
    active: number;
    total: number;
  };
  channels: {
    active: number;
    disabled: number;
    total: number;
  };
  contactWays: {
    active: number;
    total: number;
  };
  externalContacts: {
    today: number;
    total: number;
  };
  scans: {
    firstBind: number;
    today: number;
    total: number;
  };
  updatedAt: null | string;
}

export interface CreateCrmSalesQrcodePayload extends CrmMiniProgramQrcodePayload {
  channelName?: string;
  channelType?: string;
  generateWxacode?: boolean;
  salesName?: string;
  salesUserId: number;
  weworkUserId?: string;
}

export interface CreateCrmSalesQrcodeResponse {
  channel: CrmSalesChannel;
  wxacode?: CrmWxacode;
}

export interface ResolveCrmInvitePayload {
  customerName?: string;
  openid?: string;
  phone?: string;
  scene: string;
  source?: string;
  unionid?: string;
}

export interface ResolveCrmInviteResponse {
  binding: CrmOwnerBinding | null;
  bound?: boolean;
  channel: CrmSalesChannel;
  contactWay?: CrmWeworkContactWay | null;
  contactWayError?: string;
  identityRequired?: boolean;
  isFirstBind: boolean;
  owner: {
    contactQrCode: string;
    phone: string;
    salesName: string;
    salesUserId: number;
    username: string;
    weworkUserId: string;
  };
  reason?: string;
}

export interface SaveCrmOwnerBindingPayload {
  customerName?: string;
  externalUserId?: string;
  firstChannelId?: number;
  id?: number;
  openid?: string;
  ownerSalesUserId?: number;
  phone?: string;
  scene?: string;
  unionid?: string;
}

export async function getCrmConfigStatusApi() {
  return requestClient.get<CrmConfigStatus>('/crm/config/status');
}

export async function getCrmOverviewStatsApi() {
  return requestClient.get<CrmOverviewStats>('/crm/overview');
}

export async function createCrmMiniProgramQrcodeTestApi(
  payload: CrmMiniProgramQrcodePayload,
) {
  return requestClient.post<CrmMiniProgramQrcodeResponse>(
    '/crm/miniprogram/qrcode-test',
    payload,
  );
}

export async function getCrmInviteWxacodeApi(params: {
  envVersion?: string;
  page?: string;
  scene: string;
  width?: number;
}) {
  return requestClient.get<CrmInviteWxacodeResponse>('/crm/invite/wxacode', {
    params,
  });
}

export async function getCrmInviteH5QrcodeApi(params: {
  scene: string;
  width?: number;
}) {
  return requestClient.get<CrmInviteH5QrcodeResponse>('/crm/invite/h5-qrcode', {
    params,
  });
}

export async function getCrmInviteUrlLinkApi(params: {
  envVersion?: string;
  expireInterval?: number;
  page?: string;
  scene: string;
}) {
  return requestClient.get<CrmInviteUrlLinkResponse>('/crm/invite/url-link', {
    params,
  });
}

export async function createCrmSalesQrcodeApi(
  payload: CreateCrmSalesQrcodePayload,
) {
  return requestClient.post<CreateCrmSalesQrcodeResponse>(
    '/crm/sales/qrcode',
    payload,
  );
}

export async function resolveCrmInviteApi(payload: ResolveCrmInvitePayload) {
  return requestClient.post<ResolveCrmInviteResponse>(
    '/crm/invite/resolve',
    payload,
  );
}

export async function updateCrmSalesChannelApi(payload: {
  channelName?: string;
  channelType?: string;
  id: number;
  qrCodeUrl?: string;
  salesName?: string;
  status?: number;
  weworkUserId?: string;
}) {
  return requestClient.post<CrmSalesChannel>(
    '/crm/sales/channel/update',
    payload,
  );
}

export async function transferCrmOwnerBindingApi(payload: {
  id: number;
  reason?: string;
  toSalesUserId: number;
  toWeworkUserId?: string;
}) {
  return requestClient.post<{
    binding: CrmOwnerBinding;
    fromOwnerSalesUserId: number;
    reason: string;
    toOwnerSalesUserId: number;
  }>('/crm/binding/transfer', payload);
}

export async function createCrmOwnerBindingApi(
  payload: SaveCrmOwnerBindingPayload,
) {
  return requestClient.post<CrmOwnerBinding>('/crm/binding/create', payload);
}

export async function updateCrmOwnerBindingApi(
  payload: SaveCrmOwnerBindingPayload & { id: number },
) {
  return requestClient.post<CrmOwnerBinding>('/crm/binding/update', payload);
}

export async function deleteCrmOwnerBindingApi(payload: {
  id: number;
  reason?: string;
}) {
  return requestClient.post<CrmOwnerBinding>('/crm/binding/delete', payload);
}

export async function updateCrmOwnerBindingStatusApi(payload: {
  id: number;
  reason?: string;
  status: number;
}) {
  return requestClient.post<CrmOwnerBinding>('/crm/binding/status', payload);
}

export async function listCrmOwnerBindingsApi(params?: {
  currentPage?: number;
  keyword?: string;
  openid?: string;
  pageSize?: number;
  phone?: string;
  salesUserId?: number;
  scene?: string;
}) {
  return requestClient.get<{
    currentPage: number;
    items: CrmOwnerBinding[];
    pageSize: number;
    total: number;
  }>('/crm/binding/list', { params });
}

export async function getCrmSalesContactWayApi(params: {
  bindingId?: number;
  refresh?: boolean;
  salesUserId: number;
  state?: string;
  weworkUserId?: string;
}) {
  return requestClient.get<CrmWeworkContactWay>('/crm/sales/contact-way', {
    params,
  });
}

export async function listCrmSalesChannelsApi(params?: {
  currentPage?: number;
  pageSize?: number;
  salesUserId?: number;
  scene?: string;
  status?: number;
}) {
  return requestClient.get<{
    currentPage: number;
    items: CrmSalesChannel[];
    pageSize: number;
    total: number;
  }>('/crm/sales/channel/list', { params });
}

export async function listCrmExternalContactLogsApi(params?: {
  bindingId?: number;
  changeType?: string;
  currentPage?: number;
  externalUserId?: string;
  keyword?: string;
  pageSize?: number;
  salesUserId?: number;
  state?: string;
  weworkUserId?: string;
}) {
  return requestClient.get<{
    currentPage: number;
    items: CrmExternalContactLog[];
    pageSize: number;
    total: number;
  }>('/crm/external-contact/list', { params });
}

export async function listCrmScanLogsApi(params?: {
  currentPage?: number;
  keyword?: string;
  openid?: string;
  pageSize?: number;
  phone?: string;
  salesUserId?: number;
  scene?: string;
  unionid?: string;
}) {
  return requestClient.get<{
    currentPage: number;
    items: CrmScanLog[];
    pageSize: number;
    total: number;
  }>('/crm/scan-log/list', { params });
}
