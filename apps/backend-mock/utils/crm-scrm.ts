import { randomUUID } from 'node:crypto';

import { systemDbClient } from '~/utils/db';

export class CrmScmError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CrmScmError';
    this.statusCode = statusCode;
  }
}

export interface CrmIdentityInput {
  customerAddress?: unknown;
  customerName?: unknown;
  openid?: unknown;
  phone?: unknown;
  unionid?: unknown;
}

export interface CrmInviteResolveInput extends CrmIdentityInput {
  ip?: unknown;
  scene?: unknown;
  source?: unknown;
  userAgent?: unknown;
}

export interface CreateCrmSalesChannelInput {
  channelName?: unknown;
  channelType?: unknown;
  createdById?: unknown;
  qrCodeUrl?: unknown;
  salesName?: unknown;
  salesUserId?: unknown;
  scene?: unknown;
  weworkUserId?: unknown;
}

export interface SaveCrmContactWayInput {
  configId?: unknown;
  expiresAt?: Date | null;
  qrCode?: unknown;
  salesUserId?: unknown;
  state?: unknown;
  weworkUserId?: unknown;
}

export interface UpdateCrmSalesChannelInput {
  channelName?: unknown;
  channelType?: unknown;
  id?: unknown;
  qrCodeUrl?: unknown;
  salesName?: unknown;
  status?: unknown;
  weworkUserId?: unknown;
}

export interface TransferCrmOwnerBindingInput {
  id?: unknown;
  operatorUserId?: unknown;
  reason?: unknown;
  toSalesUserId?: unknown;
  toWeworkUserId?: unknown;
}

export interface CreateCrmOwnerBindingInput {
  customerAddress?: unknown;
  customerName?: unknown;
  externalUserId?: unknown;
  firstChannelId?: unknown;
  openid?: unknown;
  operatorUserId?: unknown;
  ownerSalesUserId?: unknown;
  phone?: unknown;
  scene?: unknown;
  unionid?: unknown;
}

export interface UpdateCrmOwnerBindingInput {
  customerAddress?: unknown;
  customerName?: unknown;
  externalUserId?: unknown;
  id?: unknown;
  openid?: unknown;
  operatorUserId?: unknown;
  phone?: unknown;
  unionid?: unknown;
}

export interface DeleteCrmOwnerBindingInput {
  id?: unknown;
  operatorUserId?: unknown;
  reason?: unknown;
}

export interface UpdateCrmOwnerBindingStatusInput {
  id?: unknown;
  operatorUserId?: unknown;
  reason?: unknown;
  status?: unknown;
}

export interface RecordCrmExternalContactInput {
  changeType?: unknown;
  eventType?: unknown;
  externalUserId?: unknown;
  rawPayload?: unknown;
  state?: unknown;
  welcomeCode?: unknown;
  weworkUserId?: unknown;
}

function normalizeString(value: unknown, maxLength: number): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim().slice(0, maxLength);
}

function normalizeRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
) {
  const normalized = normalizeString(value, maxLength);
  if (!normalized) {
    throw new CrmScmError(`${fieldName}不能为空`);
  }
  return normalized;
}

function normalizePositiveInt(value: unknown, fieldName: string) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new CrmScmError(`${fieldName}必须是有效的正整数`);
  }
  return num;
}

function normalizeCrmStatus(value: unknown, fieldName = 'status') {
  const num = Number(value);
  if (!Number.isInteger(num) || ![0, 1].includes(num)) {
    throw new CrmScmError(`${fieldName}只能是0或1`);
  }
  return num;
}

export function normalizeCrmPhone(value: unknown) {
  const normalized = normalizeString(value, 20);
  if (!normalized) {
    return '';
  }
  const digits = normalized.replaceAll(/\D/g, '');
  if (!/^\d{11}$/.test(digits)) {
    throw new CrmScmError('手机号格式不正确');
  }
  return digits;
}

export function normalizeCrmIdentity(input: CrmIdentityInput) {
  const customerAddress = normalizeString(input.customerAddress, 255);
  const customerName = normalizeString(input.customerName, 50);
  const phone = normalizeCrmPhone(input.phone);
  const unionid = normalizeString(input.unionid, 128);
  const openid = normalizeString(input.openid, 128);

  if (!phone && !unionid && !openid) {
    throw new CrmScmError('请至少提供手机号、unionid 或 openid');
  }

  return {
    customerAddress,
    customerName,
    openid,
    phone,
    unionid,
  };
}

export function normalizeOptionalCrmIdentity(input: CrmIdentityInput) {
  return {
    customerAddress: normalizeString(input.customerAddress, 255),
    customerName: normalizeString(input.customerName, 50),
    openid: normalizeString(input.openid, 128),
    phone: normalizeCrmPhone(input.phone),
    unionid: normalizeString(input.unionid, 128),
  };
}

function hasCrmIdentity(identity: {
  openid: string;
  phone: string;
  unionid: string;
}) {
  return Boolean(identity.phone || identity.unionid || identity.openid);
}

export function normalizeCrmScene(value: unknown) {
  const scene = normalizeRequiredString(value, 'scene', 32);
  if (!/^[\w:-]+$/.test(scene)) {
    throw new CrmScmError('scene 只能包含字母、数字、下划线、中横线和冒号');
  }
  return scene;
}

export function getCrmScanSourceName(source: unknown) {
  switch (String(source || '').toLowerCase()) {
    case 'app': {
      return 'App';
    }
    case 'browser':
    case 'h5': {
      return '浏览器';
    }
    case 'miniprogram': {
      return '小程序';
    }
    case 'qq': {
      return 'QQ';
    }
    case 'wechat': {
      return '微信';
    }
    default: {
      return source ? String(source) : '未知';
    }
  }
}

export function detectCrmScanSource(input: {
  fallback?: unknown;
  userAgent?: unknown;
}) {
  const fallback = normalizeString(input.fallback, 32);
  const ua = String(input.userAgent || '').toLowerCase();

  if (/miniprogram|mini program|micromessenger.+miniprogram/.test(ua)) {
    return 'miniprogram';
  }
  if (/micromessenger/.test(ua)) {
    return 'wechat';
  }
  if (/\bmqqbrowser\b|\bqq\//.test(ua)) {
    return 'qq';
  }
  if (/capacitor|wv\)|; wv\)/.test(ua)) {
    return 'app';
  }
  return fallback || 'browser';
}

function buildCrmSceneCandidate(salesUserId: number) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  return `s_${salesUserId}_${suffix}`.slice(0, 32);
}

async function buildUniqueCrmScene(salesUserId: number) {
  for (let index = 0; index < 5; index += 1) {
    const scene = buildCrmSceneCandidate(salesUserId);
    const exists = await systemDbClient.crmSalesChannel.findUnique({
      select: { id: true },
      where: { scene },
    });
    if (!exists) {
      return scene;
    }
  }
  throw new CrmScmError('生成销售二维码 scene 失败，请稍后重试', 500);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    ('code' in error || 'message' in error) &&
    (String((error as any).code) === 'P2002' ||
      /unique|duplicate/i.test(String((error as any).message || '')))
  );
}

function isRecordNotFoundError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    String((error as any).code || '') === 'P2025'
  );
}

export function isCrmSchemaMissingError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = String((error as any).code || '');
  const message = String((error as any).message || '');
  return (
    code === 'P2021' ||
    code === 'P2022' ||
    code === 'ER_NO_SUCH_TABLE' ||
    /crm_(?:sales_channel|customer_owner_binding|scan_log|wework_contact_way|external_contact_log)/i.test(
      message,
    ) ||
    /table .* does not exist/i.test(message)
  );
}

export function createCrmSchemaMissingError() {
  return new CrmScmError(
    'CRM数据表未初始化，请先执行中心库 db push 后再测试绑定',
    500,
  );
}

export function serializeCrmDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeCrmSalesChannel(channel: any) {
  return {
    channelName: channel.channelName,
    channelType: channel.channelType,
    createTime: serializeCrmDate(channel.createTime),
    createdById: channel.createdById ?? null,
    id: Number(channel.id),
    qrCodeUrl: channel.qrCodeUrl || '',
    salesName: channel.salesName || '',
    salesUserId: Number(channel.salesUserId),
    scene: channel.scene,
    status: Number(channel.status ?? 1),
    updateTime: serializeCrmDate(channel.updateTime),
    weworkUserId: channel.weworkUserId || '',
  };
}

export function serializeCrmOwnerBinding(binding: any) {
  return {
    createTime: serializeCrmDate(binding.createTime),
    customerAddress: binding.customerAddress || '',
    customerName: binding.customerName || '',
    externalUserId: binding.externalUserId || '',
    firstChannelId: binding.firstChannelId ?? null,
    firstScanAt: serializeCrmDate(binding.firstScanAt),
    firstScene: binding.firstScene,
    id: Number(binding.id),
    lastScanAt: serializeCrmDate(binding.lastScanAt),
    openid: binding.openid || '',
    ownerSalesUserId: Number(binding.ownerSalesUserId),
    ownerWeworkUserId: binding.ownerWeworkUserId || '',
    phone: binding.phone || '',
    status: Number(binding.status ?? 1),
    unionid: binding.unionid || '',
    updateTime: serializeCrmDate(binding.updateTime),
  };
}

async function serializeCrmOwnerBindingWithDisplay(binding: any) {
  const { channelMap, userMap } = await buildCrmDisplayMaps({
    channelIds: [Number(binding.firstChannelId || 0)].filter(Boolean),
    salesUserIds: [Number(binding.ownerSalesUserId || 0)].filter(Boolean),
  });
  const channel = channelMap.get(Number(binding.firstChannelId || 0));
  const user = userMap.get(Number(binding.ownerSalesUserId || 0));

  return {
    ...serializeCrmOwnerBinding(binding),
    firstChannelName: channel?.channelName || '',
    ownerSalesName:
      user?.realName || user?.username || channel?.salesName || '',
    ownerUserPhone: user?.phone || '',
  };
}

export function serializeCrmScanLog(log: any) {
  return {
    bindingId: log.bindingId ?? null,
    channelId: log.channelId ?? null,
    createTime: serializeCrmDate(log.createTime),
    customerAddress: log.customerAddress || '',
    customerName: log.customerName || '',
    id: Number(log.id),
    ip: log.ip || '',
    isFirstBind: Boolean(log.isFirstBind),
    openid: log.openid || '',
    phone: log.phone || '',
    requestedSalesUserId: log.requestedSalesUserId ?? null,
    resolvedSalesUserId: log.resolvedSalesUserId ?? null,
    scene: log.scene,
    source: log.source || '',
    sourceName: getCrmScanSourceName(log.source),
    unionid: log.unionid || '',
    userAgent: log.userAgent || '',
  };
}

export function serializeCrmExternalContactLog(log: any) {
  return {
    bindingId: log.bindingId ?? null,
    changeType: log.changeType || '',
    createTime: serializeCrmDate(log.createTime),
    eventType: log.eventType || '',
    externalUserId: log.externalUserId || '',
    id: Number(log.id),
    rawPayload: log.rawPayload || null,
    state: log.state || '',
    welcomeCode: log.welcomeCode || '',
    weworkUserId: log.weworkUserId || '',
  };
}

function normalizeCrmPageParams(input: {
  currentPage?: unknown;
  pageSize?: unknown;
}) {
  const currentPage = Math.max(1, Number(input.currentPage) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(input.pageSize) || 20));
  return {
    currentPage,
    pageSize,
  };
}

async function buildCrmDisplayMaps(input: {
  channelIds: number[];
  salesUserIds: number[];
}) {
  const channelIds = [...new Set(input.channelIds.filter(Boolean))];
  const salesUserIds = [...new Set(input.salesUserIds.filter(Boolean))];
  const [channels, users] = await Promise.all([
    channelIds.length > 0
      ? systemDbClient.crmSalesChannel.findMany({
          select: {
            channelName: true,
            id: true,
            salesName: true,
            scene: true,
          },
          where: { id: { in: channelIds } },
        })
      : Promise.resolve([]),
    salesUserIds.length > 0
      ? systemDbClient.user.findMany({
          select: {
            id: true,
            phone: true,
            realName: true,
            username: true,
          },
          where: { id: { in: salesUserIds } },
        })
      : Promise.resolve([]),
  ]);

  return {
    channelMap: new Map(
      channels.map((channel) => [Number(channel.id), channel]),
    ),
    userMap: new Map(users.map((user) => [Number(user.id), user])),
  };
}

function appendCrmWhereAnd(where: any, conditions: any[]) {
  const validConditions = conditions.filter(Boolean);
  if (validConditions.length === 0) {
    return;
  }
  where.AND = Array.isArray(where.AND)
    ? [...where.AND, ...validConditions]
    : validConditions;
}

function createCrmCustomerKeywordWhere(keyword: string) {
  if (!keyword) {
    return null;
  }

  return {
    OR: [
      { customerAddress: { contains: keyword } },
      { customerName: { contains: keyword } },
      { externalUserId: { contains: keyword } },
      { openid: { contains: keyword } },
      { phone: { contains: keyword } },
      { unionid: { contains: keyword } },
    ],
  };
}

function createCrmScanLogKeywordWhere(keyword: string) {
  if (!keyword) {
    return null;
  }

  return {
    OR: [
      { customerAddress: { contains: keyword } },
      { customerName: { contains: keyword } },
      { openid: { contains: keyword } },
      { phone: { contains: keyword } },
      { unionid: { contains: keyword } },
    ],
  };
}

export async function listCrmOwnerBindings(input: {
  currentPage?: unknown;
  keyword?: unknown;
  openid?: unknown;
  pageSize?: unknown;
  phone?: unknown;
  salesUserId?: unknown;
  scene?: unknown;
  unionid?: unknown;
}) {
  const { currentPage, pageSize } = normalizeCrmPageParams(input);
  const where: any = {};
  const scene = normalizeString(input.scene, 64);
  const phone = normalizeString(input.phone, 20);
  const openid = normalizeString(input.openid, 128);
  const unionid = normalizeString(input.unionid, 128);
  const keyword = normalizeString(input.keyword, 128);

  if (scene) {
    where.firstScene = { contains: scene };
  }
  if (phone) {
    where.phone = { contains: phone };
  }
  if (openid) {
    where.openid = { contains: openid };
  }
  if (unionid) {
    where.unionid = { contains: unionid };
  }
  appendCrmWhereAnd(where, [createCrmCustomerKeywordWhere(keyword)]);
  if (input.salesUserId) {
    where.ownerSalesUserId = normalizePositiveInt(
      input.salesUserId,
      'salesUserId',
    );
  }

  const [total, bindings] = await Promise.all([
    systemDbClient.crmCustomerOwnerBinding.count({ where }),
    systemDbClient.crmCustomerOwnerBinding.findMany({
      orderBy: [{ lastScanAt: 'desc' }, { createTime: 'desc' }],
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    }),
  ]);
  const { channelMap, userMap } = await buildCrmDisplayMaps({
    channelIds: bindings
      .map((binding) => Number(binding.firstChannelId || 0))
      .filter(Boolean),
    salesUserIds: bindings
      .map((binding) => Number(binding.ownerSalesUserId || 0))
      .filter(Boolean),
  });

  return {
    currentPage,
    items: bindings.map((binding) => {
      const channel = channelMap.get(Number(binding.firstChannelId || 0));
      const user = userMap.get(Number(binding.ownerSalesUserId || 0));
      return {
        ...serializeCrmOwnerBinding(binding),
        firstChannelName: channel?.channelName || '',
        ownerSalesName:
          user?.realName || user?.username || channel?.salesName || '',
        ownerUserPhone: user?.phone || '',
      };
    }),
    pageSize,
    total,
  };
}

export async function listCrmScanLogs(input: {
  currentPage?: unknown;
  keyword?: unknown;
  openid?: unknown;
  pageSize?: unknown;
  phone?: unknown;
  salesUserId?: unknown;
  scene?: unknown;
  unionid?: unknown;
}) {
  const { currentPage, pageSize } = normalizeCrmPageParams(input);
  const where: any = {};
  const scene = normalizeString(input.scene, 64);
  const phone = normalizeString(input.phone, 20);
  const openid = normalizeString(input.openid, 128);
  const unionid = normalizeString(input.unionid, 128);
  const keyword = normalizeString(input.keyword, 128);

  if (scene) {
    where.scene = { contains: scene };
  }
  if (phone) {
    where.phone = { contains: phone };
  }
  if (openid) {
    where.openid = { contains: openid };
  }
  if (unionid) {
    where.unionid = { contains: unionid };
  }
  appendCrmWhereAnd(where, [createCrmScanLogKeywordWhere(keyword)]);
  if (input.salesUserId) {
    const salesUserId = normalizePositiveInt(input.salesUserId, 'salesUserId');
    appendCrmWhereAnd(where, [
      {
        OR: [
          { requestedSalesUserId: salesUserId },
          { resolvedSalesUserId: salesUserId },
        ],
      },
    ]);
  }

  const [total, logs] = await Promise.all([
    systemDbClient.crmScanLog.count({ where }),
    systemDbClient.crmScanLog.findMany({
      orderBy: { createTime: 'desc' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    }),
  ]);
  const { channelMap, userMap } = await buildCrmDisplayMaps({
    channelIds: logs.map((log) => Number(log.channelId || 0)).filter(Boolean),
    salesUserIds: [
      ...logs.map((log) => Number(log.requestedSalesUserId || 0)),
      ...logs.map((log) => Number(log.resolvedSalesUserId || 0)),
    ].filter(Boolean),
  });

  return {
    currentPage,
    items: logs.map((log) => {
      const channel = channelMap.get(Number(log.channelId || 0));
      const requestedUser = userMap.get(Number(log.requestedSalesUserId || 0));
      const user = userMap.get(Number(log.resolvedSalesUserId || 0));
      return {
        ...serializeCrmScanLog(log),
        channelName: channel?.channelName || '',
        requestedSalesName:
          requestedUser?.realName || requestedUser?.username || '',
        resolvedSalesName: user?.realName || user?.username || '',
      };
    }),
    pageSize,
    total,
  };
}

export async function listCrmExternalContactLogs(input: {
  bindingId?: unknown;
  changeType?: unknown;
  currentPage?: unknown;
  externalUserId?: unknown;
  keyword?: unknown;
  pageSize?: unknown;
  salesUserId?: unknown;
  state?: unknown;
  weworkUserId?: unknown;
}) {
  const { currentPage, pageSize } = normalizeCrmPageParams(input);
  const where: any = {};
  const externalUserId = normalizeString(input.externalUserId, 128);
  const weworkUserId = normalizeString(input.weworkUserId, 100);
  const state = normalizeString(input.state, 128);
  const changeType = normalizeString(input.changeType, 64);
  const keyword = normalizeString(input.keyword, 128);
  const bindingId = input.bindingId
    ? normalizePositiveInt(input.bindingId, 'bindingId')
    : null;

  if (externalUserId) {
    where.externalUserId = { contains: externalUserId };
  }
  if (weworkUserId) {
    where.weworkUserId = { contains: weworkUserId };
  }
  if (state) {
    where.state = { contains: state };
  }
  if (changeType) {
    where.changeType = { contains: changeType };
  }
  if (bindingId) {
    where.bindingId = bindingId;
  }
  if (keyword) {
    const matchedBindings =
      await systemDbClient.crmCustomerOwnerBinding.findMany({
        select: { id: true },
        where: createCrmCustomerKeywordWhere(keyword) || {},
      });
    const matchedBindingIds = matchedBindings.map((binding) =>
      Number(binding.id),
    );
    appendCrmWhereAnd(where, [
      {
        OR: [
          { externalUserId: { contains: keyword } },
          { state: { contains: keyword } },
          ...(matchedBindingIds.length > 0
            ? [{ bindingId: { in: matchedBindingIds } }]
            : []),
        ],
      },
    ]);
  }

  if (input.salesUserId) {
    const salesUserId = normalizePositiveInt(input.salesUserId, 'salesUserId');
    const bindingIds = await systemDbClient.crmCustomerOwnerBinding.findMany({
      select: { id: true },
      where: { ownerSalesUserId: salesUserId, status: 1 },
    });
    const matchedIds = bindingIds.map((binding) => Number(binding.id));

    if (bindingId) {
      if (!matchedIds.includes(bindingId)) {
        return {
          currentPage,
          items: [],
          pageSize,
          total: 0,
        };
      }
    } else {
      const salesState = `crm_sales_${salesUserId}`;
      appendCrmWhereAnd(where, [
        {
          OR:
            matchedIds.length > 0
              ? [{ bindingId: { in: matchedIds } }, { state: salesState }]
              : [{ state: salesState }],
        },
      ]);
    }
  }

  const [total, logs] = await Promise.all([
    systemDbClient.crmExternalContactLog.count({ where }),
    systemDbClient.crmExternalContactLog.findMany({
      orderBy: { createTime: 'desc' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    }),
  ]);
  const bindingIds = [
    ...new Set(logs.map((log) => Number(log.bindingId || 0)).filter(Boolean)),
  ];
  const bindings =
    bindingIds.length > 0
      ? await systemDbClient.crmCustomerOwnerBinding.findMany({
          select: {
            customerAddress: true,
            customerName: true,
            externalUserId: true,
            firstChannelId: true,
            firstScene: true,
            id: true,
            openid: true,
            ownerSalesUserId: true,
            phone: true,
            unionid: true,
          },
          where: { id: { in: bindingIds } },
        })
      : [];
  const bindingMap = new Map(
    bindings.map((binding) => [Number(binding.id), binding]),
  );
  const { channelMap, userMap } = await buildCrmDisplayMaps({
    channelIds: bindings
      .map((binding) => Number(binding.firstChannelId || 0))
      .filter(Boolean),
    salesUserIds: bindings
      .map((binding) => Number(binding.ownerSalesUserId || 0))
      .filter(Boolean),
  });

  return {
    currentPage,
    items: logs.map((log) => {
      const binding = bindingMap.get(Number(log.bindingId || 0));
      const channel = channelMap.get(Number(binding?.firstChannelId || 0));
      const user = userMap.get(Number(binding?.ownerSalesUserId || 0));
      return {
        ...serializeCrmExternalContactLog(log),
        customerAddress: binding?.customerAddress || '',
        customerName: binding?.customerName || '',
        externalUserId: log.externalUserId || binding?.externalUserId || '',
        firstChannelName: channel?.channelName || '',
        firstScene: binding?.firstScene || '',
        openid: binding?.openid || '',
        ownerSalesName:
          user?.realName || user?.username || channel?.salesName || '',
        ownerSalesUserId: binding?.ownerSalesUserId
          ? Number(binding.ownerSalesUserId)
          : null,
        phone: binding?.phone || '',
        unionid: binding?.unionid || '',
      };
    }),
    pageSize,
    total,
  };
}

export async function createCrmSalesChannel(input: CreateCrmSalesChannelInput) {
  const salesUserId = normalizePositiveInt(input.salesUserId, 'salesUserId');
  const salesUser = await systemDbClient.user.findUnique({
    select: {
      id: true,
      phone: true,
      realName: true,
      status: true,
      username: true,
    },
    where: { id: salesUserId },
  });

  if (!salesUser || Number(salesUser.status ?? 1) !== 1) {
    throw new CrmScmError('销售用户不存在或已停用');
  }

  const scene = input.scene
    ? normalizeCrmScene(input.scene)
    : await buildUniqueCrmScene(salesUserId);
  const channelName =
    normalizeString(input.channelName, 100) ||
    `${salesUser.realName || salesUser.username || salesUserId}-默认渠道`;
  const channelType = normalizeString(input.channelType, 32) || 'sales';
  const salesName =
    normalizeString(input.salesName, 50) ||
    String(salesUser.realName || salesUser.username || '');
  const weworkUserId = normalizeString(input.weworkUserId, 100);
  const qrCodeUrl = normalizeString(input.qrCodeUrl, 1024);
  const createdById = input.createdById
    ? normalizePositiveInt(input.createdById, 'createdById')
    : null;

  try {
    return await systemDbClient.crmSalesChannel.create({
      data: {
        channelName,
        channelType,
        createdById,
        qrCodeUrl: qrCodeUrl || null,
        salesName,
        salesUserId,
        scene,
        weworkUserId: weworkUserId || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CrmScmError('该 scene 已存在，请换一个 scene');
    }
    throw error;
  }
}

export async function listCrmSalesChannels(input: {
  currentPage?: unknown;
  pageSize?: unknown;
  salesUserId?: unknown;
  scene?: unknown;
  status?: unknown;
}) {
  const currentPage = Math.max(1, Number(input.currentPage) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(input.pageSize) || 20));
  const where: any = {};
  const scene = normalizeString(input.scene, 64);
  const status =
    input.status === undefined ? '' : normalizeString(input.status, 8);

  if (scene) {
    where.scene = { contains: scene };
  }
  if (input.salesUserId) {
    where.salesUserId = normalizePositiveInt(input.salesUserId, 'salesUserId');
  }
  if (status !== '') {
    const statusNumber = Number(status);
    if (Number.isInteger(statusNumber)) {
      where.status = statusNumber;
    }
  }

  const [total, channels] = await Promise.all([
    systemDbClient.crmSalesChannel.count({ where }),
    systemDbClient.crmSalesChannel.findMany({
      orderBy: { createTime: 'desc' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    }),
  ]);
  const channelIds = channels
    .map((channel) => Number(channel.id || 0))
    .filter(Boolean);
  const scenes = channels.map((channel) => channel.scene).filter(Boolean);

  const [scanRows, sceneScanRows, bindings] = await Promise.all([
    channelIds.length > 0
      ? systemDbClient.crmScanLog.groupBy({
          _count: { _all: true },
          by: ['channelId'],
          where: { channelId: { in: channelIds } },
        })
      : Promise.resolve([]),
    scenes.length > 0
      ? systemDbClient.crmScanLog.groupBy({
          _count: { _all: true },
          by: ['scene'],
          where: {
            channelId: null,
            scene: { in: scenes },
          },
        })
      : Promise.resolve([]),
    channelIds.length > 0
      ? systemDbClient.crmCustomerOwnerBinding.findMany({
          select: {
            firstChannelId: true,
            id: true,
          },
          where: { firstChannelId: { in: channelIds } },
        })
      : Promise.resolve([]),
  ]);

  const bindingIds = bindings
    .map((binding) => Number(binding.id || 0))
    .filter(Boolean);
  const externalRows =
    bindingIds.length > 0
      ? await systemDbClient.crmExternalContactLog.groupBy({
          _count: { _all: true },
          by: ['bindingId'],
          where: { bindingId: { in: bindingIds } },
        })
      : [];

  const scanCountMap = new Map<number, number>();
  for (const row of scanRows as any[]) {
    const channelId = Number(row.channelId || 0);
    if (channelId) {
      scanCountMap.set(channelId, Number(row._count?._all || 0));
    }
  }

  const sceneScanCountMap = new Map<string, number>();
  for (const row of sceneScanRows as any[]) {
    if (row.scene) {
      sceneScanCountMap.set(String(row.scene), Number(row._count?._all || 0));
    }
  }

  const bindingCountMap = new Map<number, number>();
  const bindingChannelMap = new Map<number, number>();
  for (const binding of bindings) {
    const bindingId = Number(binding.id || 0);
    const channelId = Number(binding.firstChannelId || 0);
    if (!bindingId || !channelId) {
      continue;
    }
    bindingChannelMap.set(bindingId, channelId);
    bindingCountMap.set(channelId, (bindingCountMap.get(channelId) || 0) + 1);
  }

  const externalCountMap = new Map<number, number>();
  for (const row of externalRows as any[]) {
    const bindingId = Number(row.bindingId || 0);
    const channelId = bindingChannelMap.get(bindingId);
    if (channelId) {
      externalCountMap.set(
        channelId,
        (externalCountMap.get(channelId) || 0) + Number(row._count?._all || 0),
      );
    }
  }

  return {
    currentPage,
    items: channels.map((channel) => {
      const channelId = Number(channel.id);
      return {
        ...serializeCrmSalesChannel(channel),
        bindingCount: bindingCountMap.get(channelId) || 0,
        externalContactCount: externalCountMap.get(channelId) || 0,
        scanCount:
          (scanCountMap.get(channelId) || 0) +
          (sceneScanCountMap.get(channel.scene) || 0),
      };
    }),
    pageSize,
    total,
  };
}

export async function getCrmOverviewStats(
  input: { salesUserId?: unknown } = {},
) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const salesUserId = input.salesUserId
    ? normalizePositiveInt(input.salesUserId, 'salesUserId')
    : null;
  const channelWhere = salesUserId ? { salesUserId } : {};
  const bindingWhere = salesUserId ? { ownerSalesUserId: salesUserId } : {};
  const scanWhere = salesUserId
    ? {
        OR: [
          { requestedSalesUserId: salesUserId },
          { resolvedSalesUserId: salesUserId },
        ],
      }
    : {};
  const contactWayWhere = salesUserId ? { salesUserId } : {};
  let externalContactWhere: any = {};

  if (salesUserId) {
    const scopedBindings =
      await systemDbClient.crmCustomerOwnerBinding.findMany({
        select: { id: true },
        where: { ownerSalesUserId: salesUserId, status: 1 },
      });
    const bindingIds = scopedBindings
      .map((binding) => Number(binding.id || 0))
      .filter(Boolean);
    const salesState = `crm_sales_${salesUserId}`;

    externalContactWhere = {
      OR:
        bindingIds.length > 0
          ? [{ bindingId: { in: bindingIds } }, { state: salesState }]
          : [{ state: salesState }],
    };
  }

  const [
    channelTotal,
    activeChannelTotal,
    bindingTotal,
    activeBindingTotal,
    scanTotal,
    todayScanTotal,
    firstBindTotal,
    contactWayTotal,
    activeContactWayTotal,
    externalContactTotal,
    todayExternalContactTotal,
  ] = await Promise.all([
    systemDbClient.crmSalesChannel.count({ where: channelWhere }),
    systemDbClient.crmSalesChannel.count({
      where: { ...channelWhere, status: 1 },
    }),
    systemDbClient.crmCustomerOwnerBinding.count({ where: bindingWhere }),
    systemDbClient.crmCustomerOwnerBinding.count({
      where: { ...bindingWhere, status: 1 },
    }),
    systemDbClient.crmScanLog.count({ where: scanWhere }),
    systemDbClient.crmScanLog.count({
      where: { ...scanWhere, createTime: { gte: todayStart } },
    }),
    systemDbClient.crmScanLog.count({
      where: { ...scanWhere, isFirstBind: true },
    }),
    systemDbClient.crmWeworkContactWay.count({ where: contactWayWhere }),
    systemDbClient.crmWeworkContactWay.count({
      where: { ...contactWayWhere, status: 1 },
    }),
    systemDbClient.crmExternalContactLog.count({
      where: externalContactWhere,
    }),
    systemDbClient.crmExternalContactLog.count({
      where: { ...externalContactWhere, createTime: { gte: todayStart } },
    }),
  ]);

  return {
    bindings: {
      active: activeBindingTotal,
      total: bindingTotal,
    },
    channels: {
      active: activeChannelTotal,
      disabled: Math.max(channelTotal - activeChannelTotal, 0),
      total: channelTotal,
    },
    contactWays: {
      active: activeContactWayTotal,
      total: contactWayTotal,
    },
    externalContacts: {
      today: todayExternalContactTotal,
      total: externalContactTotal,
    },
    scans: {
      firstBind: firstBindTotal,
      today: todayScanTotal,
      total: scanTotal,
    },
    updatedAt: serializeCrmDate(new Date()),
  };
}

export async function updateCrmSalesChannel(input: UpdateCrmSalesChannelInput) {
  const id = normalizePositiveInt(input.id, 'id');
  const data: any = {};

  if (input.channelName !== undefined) {
    data.channelName = normalizeRequiredString(
      input.channelName,
      'channelName',
      100,
    );
  }
  if (input.channelType !== undefined) {
    data.channelType = normalizeString(input.channelType, 32) || 'sales';
  }
  if (input.salesName !== undefined) {
    data.salesName = normalizeString(input.salesName, 50) || null;
  }
  if (input.weworkUserId !== undefined) {
    data.weworkUserId = normalizeString(input.weworkUserId, 100) || null;
  }
  if (input.qrCodeUrl !== undefined) {
    data.qrCodeUrl = normalizeString(input.qrCodeUrl, 1024) || null;
  }
  if (input.status !== undefined) {
    data.status = normalizeCrmStatus(input.status);
  }

  if (Object.keys(data).length === 0) {
    throw new CrmScmError('没有需要更新的渠道字段');
  }

  try {
    return await systemDbClient.crmSalesChannel.update({
      data,
      where: { id },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new CrmScmError('销售渠道不存在', 404);
    }
    throw error;
  }
}

async function resolveCrmManualBindingChannel(input: {
  firstChannelId?: unknown;
  ownerSalesUserId: number;
  scene?: unknown;
}) {
  const scene = normalizeString(input.scene, 64);
  const firstChannelId = input.firstChannelId
    ? normalizePositiveInt(input.firstChannelId, 'firstChannelId')
    : null;

  if (firstChannelId) {
    const channel = await systemDbClient.crmSalesChannel.findFirst({
      where: {
        id: firstChannelId,
        salesUserId: input.ownerSalesUserId,
      },
    });
    if (!channel) {
      throw new CrmScmError('获客渠道不存在或不属于该销售');
    }
    return channel;
  }

  if (scene) {
    const channel = await systemDbClient.crmSalesChannel.findFirst({
      where: {
        scene,
        salesUserId: input.ownerSalesUserId,
      },
    });
    if (channel) {
      return channel;
    }
  }

  return systemDbClient.crmSalesChannel.findFirst({
    orderBy: [{ updateTime: 'desc' }, { createTime: 'desc' }],
    where: {
      salesUserId: input.ownerSalesUserId,
      status: 1,
    },
  });
}

export async function createCrmOwnerBinding(input: CreateCrmOwnerBindingInput) {
  const ownerSalesUserId = normalizePositiveInt(
    input.ownerSalesUserId,
    'ownerSalesUserId',
  );
  const customerAddress = normalizeString(input.customerAddress, 255);
  const customerName = normalizeString(input.customerName, 50);
  const phone = normalizeCrmPhone(input.phone);
  const openid = normalizeString(input.openid, 128);
  const unionid = normalizeString(input.unionid, 128);
  const externalUserId = normalizeString(input.externalUserId, 128);
  const operatorUserId = input.operatorUserId
    ? normalizePositiveInt(input.operatorUserId, 'operatorUserId')
    : null;

  if (!phone && !openid && !unionid) {
    throw new CrmScmError('请至少填写手机号、OpenID 或 UnionID');
  }

  await findActiveCrmSalesUser(ownerSalesUserId);

  const existing = await findCrmBindingByIdentity({
    customerName,
    openid,
    phone,
    unionid,
  });
  if (existing) {
    throw new CrmScmError('该客户已存在，请直接编辑原客户归属');
  }

  const channel = await resolveCrmManualBindingChannel({
    firstChannelId: input.firstChannelId,
    ownerSalesUserId,
    scene: input.scene,
  });
  const firstScene =
    channel?.scene || `manual_${ownerSalesUserId}`.slice(0, 64);
  const ownerWeworkUserId = await resolveWeworkUserIdForSales({
    explicitWeworkUserId: channel?.weworkUserId || '',
    salesUserId: ownerSalesUserId,
  });

  try {
    const created = await systemDbClient.crmCustomerOwnerBinding.create({
      data: {
        customerAddress: customerAddress || null,
        customerName: customerName || null,
        externalUserId: externalUserId || null,
        firstChannelId: channel?.id ?? null,
        firstScene,
        lastScanAt: new Date(),
        openid: openid || null,
        ownerSalesUserId,
        ownerWeworkUserId: ownerWeworkUserId || null,
        phone: phone || null,
        unionid: unionid || null,
      },
    });

    await createCrmScanLog({
      bindingId: created.id,
      channelId: created.firstChannelId ?? null,
      identity: {
        customerAddress,
        customerName,
        openid,
        phone,
        unionid,
      },
      isFirstBind: true,
      requestedSalesUserId: ownerSalesUserId,
      resolvedSalesUserId: ownerSalesUserId,
      scene: firstScene,
      source: 'manual_create',
      userAgent: operatorUserId ? `operator:${operatorUserId}` : '',
    });

    return serializeCrmOwnerBindingWithDisplay(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CrmScmError('手机号、OpenID 或 UnionID 已存在');
    }
    throw error;
  }
}

async function findCrmBindingByIdentity(
  identity: {
    customerAddress?: string;
    customerName?: string;
    openid: string;
    phone: string;
    unionid: string;
  },
  options: { status?: number } = {},
) {
  const statusWhere =
    options.status === undefined ? {} : { status: options.status };

  if (identity.phone) {
    const byPhone = await systemDbClient.crmCustomerOwnerBinding.findFirst({
      where: { phone: identity.phone, ...statusWhere },
    });
    if (byPhone) return byPhone;
  }

  if (identity.unionid) {
    const byUnionid = await systemDbClient.crmCustomerOwnerBinding.findFirst({
      where: { unionid: identity.unionid, ...statusWhere },
    });
    if (byUnionid) return byUnionid;
  }

  if (identity.openid) {
    const byOpenid = await systemDbClient.crmCustomerOwnerBinding.findFirst({
      where: { openid: identity.openid, ...statusWhere },
    });
    if (byOpenid) return byOpenid;
  }

  return null;
}

export async function updateCrmOwnerBinding(input: UpdateCrmOwnerBindingInput) {
  const id = normalizePositiveInt(input.id, 'id');
  const customerAddress = normalizeString(input.customerAddress, 255);
  const customerName = normalizeString(input.customerName, 50);
  const phone = normalizeCrmPhone(input.phone);
  const openid = normalizeString(input.openid, 128);
  const unionid = normalizeString(input.unionid, 128);
  const externalUserId = normalizeString(input.externalUserId, 128);
  const operatorUserId = input.operatorUserId
    ? normalizePositiveInt(input.operatorUserId, 'operatorUserId')
    : null;

  if (!phone && !openid && !unionid) {
    throw new CrmScmError('请至少填写手机号、OpenID 或 UnionID');
  }

  const binding = await systemDbClient.crmCustomerOwnerBinding.findUnique({
    where: { id },
  });
  if (!binding) {
    throw new CrmScmError('客户归属绑定不存在', 404);
  }

  const duplicated = await findCrmBindingByIdentity({
    customerName,
    openid,
    phone,
    unionid,
  });
  if (duplicated && Number(duplicated.id) !== id) {
    throw new CrmScmError('手机号、OpenID 或 UnionID 已被其他客户使用');
  }

  try {
    const updated = await systemDbClient.crmCustomerOwnerBinding.update({
      data: {
        customerAddress: customerAddress || null,
        customerName: customerName || null,
        externalUserId: externalUserId || null,
        lastScanAt: new Date(),
        openid: openid || null,
        phone: phone || null,
        unionid: unionid || null,
      },
      where: { id },
    });

    await createCrmScanLog({
      bindingId: id,
      channelId: binding.firstChannelId ?? null,
      identity: {
        customerAddress,
        customerName,
        openid,
        phone,
        unionid,
      },
      isFirstBind: false,
      requestedSalesUserId: Number(binding.ownerSalesUserId),
      resolvedSalesUserId: Number(binding.ownerSalesUserId),
      scene: binding.firstScene,
      source: 'manual_update',
      userAgent: operatorUserId ? `operator:${operatorUserId}` : '',
    });

    return serializeCrmOwnerBindingWithDisplay(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CrmScmError('手机号、OpenID 或 UnionID 已被其他客户使用');
    }
    throw error;
  }
}

export async function deleteCrmOwnerBinding(input: DeleteCrmOwnerBindingInput) {
  const id = normalizePositiveInt(input.id, 'id');
  const reason = normalizeString(input.reason, 200);
  const operatorUserId = input.operatorUserId
    ? normalizePositiveInt(input.operatorUserId, 'operatorUserId')
    : null;

  const binding = await systemDbClient.crmCustomerOwnerBinding.findUnique({
    where: { id },
  });
  if (!binding) {
    throw new CrmScmError('客户归属绑定不存在', 404);
  }

  await createCrmScanLog({
    bindingId: id,
    channelId: binding.firstChannelId ?? null,
    identity: {
      customerAddress: binding.customerAddress || '',
      customerName: binding.customerName || '',
      openid: binding.openid || '',
      phone: binding.phone || '',
      unionid: binding.unionid || '',
    },
    isFirstBind: false,
    requestedSalesUserId: Number(binding.ownerSalesUserId),
    resolvedSalesUserId: Number(binding.ownerSalesUserId),
    scene: binding.firstScene,
    source: 'manual_delete',
    userAgent: [
      operatorUserId ? `operator:${operatorUserId}` : '',
      reason ? `reason:${reason}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  const deleted = await systemDbClient.crmCustomerOwnerBinding.delete({
    where: { id },
  });

  return serializeCrmOwnerBindingWithDisplay(deleted);
}

function buildMissingIdentityUpdate(
  binding: any,
  identity: {
    customerAddress?: string;
    customerName?: string;
    openid: string;
    phone: string;
    unionid: string;
  },
) {
  const data: any = {
    lastScanAt: new Date(),
  };
  if (identity.customerName && !binding.customerName) {
    data.customerName = identity.customerName;
  }
  if (identity.customerAddress && !binding.customerAddress) {
    data.customerAddress = identity.customerAddress;
  }
  if (identity.phone && !binding.phone) {
    data.phone = identity.phone;
  }
  if (identity.unionid && !binding.unionid) {
    data.unionid = identity.unionid;
  }
  if (identity.openid && !binding.openid) {
    data.openid = identity.openid;
  }
  return data;
}

async function updateCrmBindingLastScan(
  binding: any,
  identity: {
    customerAddress?: string;
    customerName?: string;
    openid: string;
    phone: string;
    unionid: string;
  },
) {
  try {
    return await systemDbClient.crmCustomerOwnerBinding.update({
      data: buildMissingIdentityUpdate(binding, identity),
      where: { id: binding.id },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    return systemDbClient.crmCustomerOwnerBinding.update({
      data: { lastScanAt: new Date() },
      where: { id: binding.id },
    });
  }
}

async function findActiveCrmSalesUser(salesUserId: number) {
  const salesUser = await systemDbClient.user.findUnique({
    select: {
      id: true,
      realName: true,
      status: true,
      username: true,
    },
    where: { id: salesUserId },
  });

  if (!salesUser || Number(salesUser.status ?? 1) !== 1) {
    throw new CrmScmError('目标销售用户不存在或已停用');
  }

  return salesUser;
}

async function resolveWeworkUserIdForSales(input: {
  explicitWeworkUserId: string;
  salesUserId: number;
}) {
  if (input.explicitWeworkUserId) {
    return input.explicitWeworkUserId;
  }

  const [channel, contactWay] = await Promise.all([
    systemDbClient.crmSalesChannel.findFirst({
      orderBy: [{ updateTime: 'desc' }, { createTime: 'desc' }],
      select: { weworkUserId: true },
      where: {
        salesUserId: input.salesUserId,
        status: 1,
        weworkUserId: { not: null },
      },
    }),
    systemDbClient.crmWeworkContactWay.findFirst({
      orderBy: [{ updateTime: 'desc' }, { createTime: 'desc' }],
      select: { weworkUserId: true },
      where: {
        salesUserId: input.salesUserId,
        status: 1,
      },
    }),
  ]);

  return channel?.weworkUserId || contactWay?.weworkUserId || '';
}

export async function transferCrmOwnerBinding(
  input: TransferCrmOwnerBindingInput,
) {
  const id = normalizePositiveInt(input.id, 'id');
  const toSalesUserId = normalizePositiveInt(
    input.toSalesUserId,
    'toSalesUserId',
  );
  const toWeworkUserId = normalizeString(input.toWeworkUserId, 100);
  const reason = normalizeString(input.reason, 200);
  const operatorUserId = input.operatorUserId
    ? normalizePositiveInt(input.operatorUserId, 'operatorUserId')
    : null;

  await findActiveCrmSalesUser(toSalesUserId);

  const binding = await systemDbClient.crmCustomerOwnerBinding.findUnique({
    where: { id },
  });
  if (!binding) {
    throw new CrmScmError('客户归属绑定不存在', 404);
  }

  const nextWeworkUserId = await resolveWeworkUserIdForSales({
    explicitWeworkUserId: toWeworkUserId,
    salesUserId: toSalesUserId,
  });

  const updated = await systemDbClient.crmCustomerOwnerBinding.update({
    data: {
      lastScanAt: new Date(),
      ownerSalesUserId: toSalesUserId,
      ownerWeworkUserId: nextWeworkUserId || null,
      status: 1,
    },
    where: { id },
  });

  await createCrmScanLog({
    bindingId: id,
    channelId: binding.firstChannelId ?? null,
    identity: {
      customerAddress: binding.customerAddress || '',
      customerName: binding.customerName || '',
      openid: binding.openid || '',
      phone: binding.phone || '',
      unionid: binding.unionid || '',
    },
    isFirstBind: false,
    requestedSalesUserId: Number(binding.ownerSalesUserId),
    resolvedSalesUserId: toSalesUserId,
    scene: binding.firstScene,
    source: 'manual_transfer',
    userAgent: [
      operatorUserId ? `operator:${operatorUserId}` : '',
      reason ? `reason:${reason}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return {
    binding: serializeCrmOwnerBinding(updated),
    fromOwnerSalesUserId: Number(binding.ownerSalesUserId),
    reason,
    toOwnerSalesUserId: toSalesUserId,
  };
}

export async function updateCrmOwnerBindingStatus(
  input: UpdateCrmOwnerBindingStatusInput,
) {
  const id = normalizePositiveInt(input.id, 'id');
  const status = normalizeCrmStatus(input.status);
  const reason = normalizeString(input.reason, 200);
  const operatorUserId = input.operatorUserId
    ? normalizePositiveInt(input.operatorUserId, 'operatorUserId')
    : null;

  const binding = await systemDbClient.crmCustomerOwnerBinding.findUnique({
    where: { id },
  });
  if (!binding) {
    throw new CrmScmError('客户归属绑定不存在', 404);
  }

  const updated = await systemDbClient.crmCustomerOwnerBinding.update({
    data: {
      lastScanAt: new Date(),
      status,
    },
    where: { id },
  });

  await createCrmScanLog({
    bindingId: id,
    channelId: binding.firstChannelId ?? null,
    identity: {
      customerAddress: binding.customerAddress || '',
      customerName: binding.customerName || '',
      openid: binding.openid || '',
      phone: binding.phone || '',
      unionid: binding.unionid || '',
    },
    isFirstBind: false,
    requestedSalesUserId: Number(binding.ownerSalesUserId),
    resolvedSalesUserId: Number(binding.ownerSalesUserId),
    scene: binding.firstScene,
    source: status === 1 ? 'manual_binding_enable' : 'manual_binding_disable',
    userAgent: [
      operatorUserId ? `operator:${operatorUserId}` : '',
      reason ? `reason:${reason}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return serializeCrmOwnerBinding(updated);
}

async function createCrmScanLog(input: {
  bindingId?: null | number;
  channelId?: null | number;
  identity: {
    customerAddress?: string;
    customerName?: string;
    openid: string;
    phone: string;
    unionid: string;
  };
  ip?: string;
  isFirstBind: boolean;
  requestedSalesUserId?: null | number;
  resolvedSalesUserId?: null | number;
  scene: string;
  source?: string;
  userAgent?: string;
}) {
  try {
    await systemDbClient.crmScanLog.create({
      data: {
        bindingId: input.bindingId ?? null,
        channelId: input.channelId ?? null,
        customerAddress: input.identity.customerAddress || null,
        customerName: input.identity.customerName || null,
        ip: input.ip ? input.ip.slice(0, 64) : null,
        isFirstBind: input.isFirstBind,
        openid: input.identity.openid || null,
        phone: input.identity.phone || null,
        requestedSalesUserId: input.requestedSalesUserId ?? null,
        resolvedSalesUserId: input.resolvedSalesUserId ?? null,
        scene: input.scene,
        source: input.source ? input.source.slice(0, 32) : null,
        unionid: input.identity.unionid || null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
      },
    });
  } catch (error) {
    console.warn('[crm-scrm] create scan log failed:', error);
  }
}

export async function getCrmOwnerProfile(salesUserId: number) {
  const [user, contactWay] = await Promise.all([
    systemDbClient.user.findUnique({
      select: {
        id: true,
        phone: true,
        realName: true,
        username: true,
      },
      where: { id: salesUserId },
    }),
    systemDbClient.crmWeworkContactWay.findFirst({
      orderBy: { updateTime: 'desc' },
      where: {
        salesUserId,
        status: 1,
        state: `crm_sales_${salesUserId}`,
      },
    }),
  ]);

  return {
    contactQrCode: contactWay?.qrCode || '',
    phone: user?.phone || '',
    salesName: user?.realName || user?.username || `销售${salesUserId}`,
    salesUserId,
    username: user?.username || '',
    weworkUserId: contactWay?.weworkUserId || '',
  };
}

export async function resolveCrmInvite(input: CrmInviteResolveInput) {
  const scene = normalizeCrmScene(input.scene);
  const identity = normalizeOptionalCrmIdentity(input);
  const ip = normalizeString(input.ip, 64);
  const userAgent = normalizeString(input.userAgent, 255);
  const source = detectCrmScanSource({
    fallback: input.source,
    userAgent,
  });

  const channel = await systemDbClient.crmSalesChannel.findUnique({
    where: { scene },
  });

  if (!channel || Number(channel.status ?? 1) !== 1) {
    throw new CrmScmError('二维码渠道不存在或已停用', 404);
  }

  if (!hasCrmIdentity(identity)) {
    await createCrmScanLog({
      bindingId: null,
      channelId: channel.id,
      identity,
      ip,
      isFirstBind: false,
      requestedSalesUserId: channel.salesUserId,
      resolvedSalesUserId: null,
      scene,
      source,
      userAgent,
    });

    return {
      binding: null,
      bound: false,
      channel: serializeCrmSalesChannel(channel),
      identityRequired: true,
      isFirstBind: false,
      owner: await getCrmOwnerProfile(Number(channel.salesUserId)),
      reason: 'IDENTITY_REQUIRED',
    };
  }

  let binding = await findCrmBindingByIdentity(identity, { status: 1 });
  let isFirstBind = false;

  if (binding) {
    binding = await updateCrmBindingLastScan(binding, identity);
  } else {
    const inactiveBinding = await findCrmBindingByIdentity(identity, {
      status: 0,
    });

    if (inactiveBinding) {
      binding = await updateCrmBindingLastScan(inactiveBinding, identity);
    } else {
      isFirstBind = true;
      try {
        binding = await systemDbClient.crmCustomerOwnerBinding.create({
          data: {
            customerAddress: identity.customerAddress || null,
            customerName: identity.customerName || null,
            externalUserId: null,
            firstChannelId: channel.id,
            firstScene: channel.scene,
            lastScanAt: new Date(),
            openid: identity.openid || null,
            ownerSalesUserId: channel.salesUserId,
            ownerWeworkUserId: channel.weworkUserId || null,
            phone: identity.phone || null,
            unionid: identity.unionid || null,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        const existing =
          (await findCrmBindingByIdentity(identity, { status: 1 })) ||
          (await findCrmBindingByIdentity(identity, { status: 0 }));
        if (!existing) {
          throw error;
        }
        isFirstBind = false;
        binding = await updateCrmBindingLastScan(existing, identity);
      }
    }
  }

  await createCrmScanLog({
    bindingId: binding.id,
    channelId: channel.id,
    identity: {
      ...identity,
      customerAddress:
        identity.customerAddress || binding.customerAddress || '',
      customerName: identity.customerName || binding.customerName || '',
    },
    ip,
    isFirstBind,
    requestedSalesUserId: channel.salesUserId,
    resolvedSalesUserId: binding.ownerSalesUserId,
    scene,
    source,
    userAgent,
  });

  const owner = await getCrmOwnerProfile(Number(binding.ownerSalesUserId));

  return {
    binding: serializeCrmOwnerBinding(binding),
    channel: serializeCrmSalesChannel(channel),
    isFirstBind,
    owner: {
      ...owner,
      weworkUserId: binding.ownerWeworkUserId || owner.weworkUserId,
    },
  };
}

export async function saveCrmContactWay(input: SaveCrmContactWayInput) {
  const salesUserId = normalizePositiveInt(input.salesUserId, 'salesUserId');
  const weworkUserId = normalizeRequiredString(
    input.weworkUserId,
    'weworkUserId',
    100,
  );
  const state = normalizeString(input.state, 128) || `crm_sales_${salesUserId}`;
  const configId = normalizeString(input.configId, 128);
  const qrCode = normalizeString(input.qrCode, 1024);

  return systemDbClient.crmWeworkContactWay.upsert({
    create: {
      configId: configId || null,
      expiresAt: input.expiresAt ?? null,
      qrCode: qrCode || null,
      salesUserId,
      state,
      weworkUserId,
    },
    update: {
      configId: configId || null,
      expiresAt: input.expiresAt ?? null,
      qrCode: qrCode || null,
      status: 1,
      weworkUserId,
    },
    where: { state },
  });
}

export function serializeCrmContactWay(contactWay: any) {
  return {
    configId: contactWay.configId || '',
    createTime: serializeCrmDate(contactWay.createTime),
    expiresAt: serializeCrmDate(contactWay.expiresAt),
    id: Number(contactWay.id),
    qrCode: contactWay.qrCode || '',
    salesUserId: Number(contactWay.salesUserId),
    state: contactWay.state,
    status: Number(contactWay.status ?? 1),
    updateTime: serializeCrmDate(contactWay.updateTime),
    weworkUserId: contactWay.weworkUserId,
  };
}

export async function recordCrmExternalContactEvent(
  input: RecordCrmExternalContactInput,
) {
  const state = normalizeString(input.state, 128);
  const weworkUserId = normalizeString(input.weworkUserId, 100);
  const externalUserId = normalizeString(input.externalUserId, 128);
  const eventType = normalizeString(input.eventType, 64);
  const changeType = normalizeString(input.changeType, 64);
  const welcomeCode = normalizeString(input.welcomeCode, 255);

  let matchedBindingId: null | number = null;

  const bindingStateMatch = state.match(/^crm_binding_(\d+)$/);
  if (bindingStateMatch?.[1]) {
    const binding = await systemDbClient.crmCustomerOwnerBinding.findFirst({
      select: { id: true },
      where: {
        id: Number(bindingStateMatch[1]),
        status: 1,
      },
    });
    if (binding) {
      matchedBindingId = Number(binding.id);
    }
  }

  if (!matchedBindingId && state && !state.startsWith('crm_')) {
    const candidates = await systemDbClient.crmCustomerOwnerBinding.findMany({
      orderBy: [{ lastScanAt: 'desc' }, { updateTime: 'desc' }],
      select: { id: true },
      take: 2,
      where: {
        firstScene: state,
        status: 1,
        ...(weworkUserId ? { ownerWeworkUserId: weworkUserId } : {}),
      },
    });
    if (candidates.length === 1 && candidates[0]) {
      matchedBindingId = Number(candidates[0].id);
    }
  }

  if (!matchedBindingId && externalUserId) {
    const binding = await systemDbClient.crmCustomerOwnerBinding.findFirst({
      orderBy: { updateTime: 'desc' },
      select: { id: true },
      where: {
        externalUserId,
        status: 1,
      },
    });
    if (binding) {
      matchedBindingId = Number(binding.id);
    }
  }

  if (matchedBindingId && externalUserId) {
    await systemDbClient.crmCustomerOwnerBinding.update({
      data: {
        externalUserId,
        lastScanAt: new Date(),
        ...(weworkUserId ? { ownerWeworkUserId: weworkUserId } : {}),
      },
      where: { id: matchedBindingId },
    });
  }

  return systemDbClient.crmExternalContactLog.create({
    data: {
      bindingId: matchedBindingId,
      changeType: changeType || null,
      eventType: eventType || null,
      externalUserId: externalUserId || null,
      rawPayload: (input.rawPayload || {}) as any,
      state: state || null,
      welcomeCode: welcomeCode || null,
      weworkUserId: weworkUserId || null,
    },
  });
}
