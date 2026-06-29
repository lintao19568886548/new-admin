<script lang="ts" setup>
import type {
  CreateCrmSalesQrcodeResponse,
  CrmConfigStatus,
  CrmExternalContactLog,
  CrmInviteH5QrcodeResponse,
  CrmOverviewStats,
  CrmOwnerBinding,
  CrmSalesChannel,
  CrmScanLog,
} from '#/api/crm';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';
import html2canvas from 'html2canvas';

import {
  createCrmOwnerBindingApi,
  createCrmSalesQrcodeApi,
  deleteCrmOwnerBindingApi,
  getCrmConfigStatusApi,
  getCrmInviteH5QrcodeApi,
  getCrmOverviewStatsApi,
  listCrmExternalContactLogsApi,
  listCrmOwnerBindingsApi,
  listCrmSalesChannelsApi,
  listCrmScanLogsApi,
  transferCrmOwnerBindingApi,
  updateCrmOwnerBindingApi,
  updateCrmOwnerBindingStatusApi,
  updateCrmSalesChannelApi,
} from '#/api/crm';
import { getSystemUserList } from '#/api/system/user';
import { getWechatJsSdkConfig } from '#/api/wechat';
import { initWechatJssdk } from '#/utils/wechat-jssdk';
import { applyWechatH5ShareCard } from '#/utils/wechat-share';

type DataTabKey = 'bindings' | 'channels' | 'externalLogs' | 'scanLogs';

const emptyTableLocale = {
  emptyText: '暂无数据',
};

const userStore = useUserStore();

const configLoading = ref(false);
const overviewLoading = ref(false);
const salesLoading = ref(false);
const bindingLoading = ref(false);
const channelLoading = ref(false);
const externalLogLoading = ref(false);
const scanLogLoading = ref(false);
const rowActionLoading = ref(false);
const rowActionLoadingKey = ref('');
const salesUserOptionsLoading = ref(false);

const activeDataTab = ref<DataTabKey>('bindings');
const configStatus = ref<CrmConfigStatus | null>(null);
const overview = ref<CrmOverviewStats | null>(null);
const salesResult = ref<CreateCrmSalesQrcodeResponse | null>(null);
const inviteQrcode = ref<CrmInviteH5QrcodeResponse | null>(null);
const inviteEntryError = ref('');
const bindingItems = ref<CrmOwnerBinding[]>([]);
const channelItems = ref<CrmSalesChannel[]>([]);
const externalLogItems = ref<CrmExternalContactLog[]>([]);
const scanLogItems = ref<CrmScanLog[]>([]);
const salesUserOptions = ref<{ label: string; value: number }[]>([]);
const bindingTotal = ref(0);
const channelTotal = ref(0);
const externalLogTotal = ref(0);
const scanLogTotal = ref(0);
const posterDataUrl = ref('');
const posterRendering = ref(false);
const posterRef = ref<HTMLElement | null>(null);
const transferModalOpen = ref(false);
const transferRecord = ref<CrmOwnerBinding | null>(null);
const transferTargetSalesUserId = ref<number>();
const bindingModalOpen = ref(false);
const bindingModalMode = ref<'create' | 'edit'>('create');
const bindingSaving = ref(false);

const bindingForm = reactive<{
  customerAddress: string;
  customerName: string;
  externalUserId: string;
  id?: number;
  openid: string;
  ownerSalesUserId?: number;
  phone: string;
  scene: string;
  unionid: string;
}>({
  customerAddress: '',
  customerName: '',
  externalUserId: '',
  id: undefined,
  openid: '',
  ownerSalesUserId: undefined,
  phone: '',
  scene: '',
  unionid: '',
});

const listQuery = reactive<{
  currentPage: number;
  keyword: string;
  pageSize: number;
  phone: string;
  salesUserId?: number;
  scene: string;
}>({
  currentPage: 1,
  keyword: '',
  pageSize: 10,
  phone: '',
  salesUserId: undefined,
  scene: '',
});

const externalLogQuery = reactive<{
  bindingId?: number;
  state: string;
}>({
  bindingId: undefined,
  state: '',
});

const bindingColumns = [
  { dataIndex: 'customerName', title: '客户姓名', width: 120 },
  { dataIndex: 'phone', title: '手机号', width: 140 },
  { dataIndex: 'customerAddress', title: '详细地址', width: 220 },
  { dataIndex: 'wechatIdentity', title: '微信标识', width: 180 },
  { dataIndex: 'externalUserId', title: '企微客户ID', width: 180 },
  { dataIndex: 'ownerSalesName', title: '归属销售', width: 140 },
  { dataIndex: 'firstChannelName', title: '来源渠道', width: 180 },
  { dataIndex: 'firstScanAt', title: '首次绑定', width: 170 },
  { dataIndex: 'lastScanAt', title: '最近扫码', width: 170 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { fixed: 'right' as const, key: 'action', title: '操作', width: 340 },
];

const scanLogColumns = [
  { dataIndex: 'createTime', title: '扫码时间', width: 170 },
  { dataIndex: 'customerName', title: '客户姓名', width: 120 },
  { dataIndex: 'phone', title: '手机号', width: 140 },
  { dataIndex: 'customerAddress', title: '详细地址', width: 220 },
  { dataIndex: 'wechatIdentity', title: '微信标识', width: 180 },
  { dataIndex: 'sourceName', title: '扫码来源', width: 110 },
  { dataIndex: 'channelName', title: '二维码渠道', width: 180 },
  { dataIndex: 'requestedSalesName', title: '二维码销售', width: 140 },
  { dataIndex: 'resolvedSalesName', title: '实际归属', width: 140 },
  { dataIndex: 'isFirstBind', title: '首次绑定', width: 100 },
];

const channelColumns = [
  { dataIndex: 'channelName', title: '渠道名称', width: 200 },
  { dataIndex: 'salesName', title: '归属销售', width: 140 },
  { dataIndex: 'scanCount', title: '扫码数', width: 90 },
  { dataIndex: 'bindingCount', title: '客户数', width: 90 },
  { dataIndex: 'externalContactCount', title: '企微添加', width: 100 },
  { dataIndex: 'createTime', title: '创建时间', width: 170 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { fixed: 'right' as const, key: 'action', title: '操作', width: 220 },
];

const externalLogColumns = [
  { dataIndex: 'customerName', title: '客户姓名', width: 120 },
  { dataIndex: 'phone', title: '手机号', width: 140 },
  { dataIndex: 'customerAddress', title: '详细地址', width: 220 },
  { dataIndex: 'wechatIdentity', title: '微信标识', width: 180 },
  { dataIndex: 'externalUserId', title: '企微客户ID', width: 180 },
  { dataIndex: 'ownerSalesName', title: '归属销售', width: 140 },
  { dataIndex: 'firstChannelName', title: '来源渠道', width: 180 },
  { dataIndex: 'changeType', title: '动作', width: 130 },
  { dataIndex: 'createTime', title: '添加时间', width: 170 },
];

const currentUserInfo = computed(
  () => (userStore.userInfo || {}) as Record<string, unknown>,
);

const currentUserId = computed(() => {
  const info = currentUserInfo.value;
  const id = Number(info.centerUserId || info.id || info.userId || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
});

const currentSalesName = computed(() => {
  const info = currentUserInfo.value;
  return String(info.realName || info.username || info.name || '').trim();
});

const currentRoleNames = computed(() => {
  const roles = currentUserInfo.value.roles;
  return Array.isArray(roles) ? roles.map(String).filter(Boolean) : [];
});

const isSuperUser = computed(() => currentRoleNames.value.includes('Super'));

const crmDataScopeName = computed(() =>
  isSuperUser.value ? '全部用户获客数据' : '仅本人获客数据',
);

const currentPublicOrigin = computed(() => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin.replace(/\/+$/, '');
});

const isLocalPublicOrigin = computed(() => {
  if (!currentPublicOrigin.value) {
    return false;
  }
  return /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(
    currentPublicOrigin.value,
  );
});

const currentScene = computed(
  () => salesResult.value?.channel.scene || listQuery.scene,
);

const h5FallbackInviteUrl = computed(() => {
  const configuredBase = configStatus.value?.inviteH5Url || '';
  const base = isLocalPublicOrigin.value
    ? `${currentPublicOrigin.value}/invite/crm`
    : configuredBase;
  if (!base || !currentScene.value) {
    return '';
  }
  return `${base}?scene=${encodeURIComponent(currentScene.value)}`;
});

const crossChannelInviteUrl = computed(
  () => inviteQrcode.value?.inviteUrl || h5FallbackInviteUrl.value,
);

const inviteEntryTypeName = computed(() => 'H5授权页');

const shareText = computed(() => {
  const slogan = '智慧园区一体化管理系统--全流程数字化管控，让园区运营降本增效';
  const linkUrl = crossChannelInviteUrl.value;
  if (!linkUrl) {
    return slogan;
  }
  return `${slogan}\n点击授权领取专属服务：${linkUrl}`;
});

const shareTitle = computed(() => {
  const salesName =
    salesResult.value?.channel.salesName || currentSalesName.value;
  return salesName ? `${salesName}邀请您了解瞰维智管` : '瞰维智管获客推广';
});

const shareDescription = computed(
  () => '请进入授权页留下联系方式，我们的销售团队稍后联系您。',
);

const shareImageUrl = computed(
  () => `${currentPublicOrigin.value}/assets/favicon.png`,
);

const isWechatBrowser = computed(() => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /MicroMessenger/i.test(navigator.userAgent);
});

const isMobileBrowser = computed(() => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
});

const qrcodeImageUrl = computed(() => inviteQrcode.value?.qrcode.dataUrl || '');

const recordsLoading = computed(
  () =>
    bindingLoading.value ||
    channelLoading.value ||
    externalLogLoading.value ||
    scanLogLoading.value,
);

const activeMobileItems = computed(() => {
  switch (activeDataTab.value) {
    case 'bindings': {
      return bindingItems.value;
    }
    case 'channels': {
      return channelItems.value;
    }
    case 'externalLogs': {
      return externalLogItems.value;
    }
    case 'scanLogs': {
      return scanLogItems.value;
    }
    default: {
      return [];
    }
  }
});

const activeMobileTotal = computed(() => {
  switch (activeDataTab.value) {
    case 'bindings': {
      return bindingTotal.value;
    }
    case 'channels': {
      return channelTotal.value;
    }
    case 'externalLogs': {
      return externalLogTotal.value;
    }
    case 'scanLogs': {
      return scanLogTotal.value;
    }
    default: {
      return 0;
    }
  }
});

const bindingModalTitle = computed(() =>
  bindingModalMode.value === 'create' ? '新增客户' : '编辑客户',
);

onMounted(() => {
  void refreshRuntimeInfo();
  void refreshCrmRecords();
  void refreshSalesUserOptions();
});

function normalizeOptionalText(value?: null | string) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function formatDate(value?: null | string) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatNumber(value?: null | number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function maskPhone(value?: null | string) {
  const phone = String(value || '').trim();
  return /^\d{11}$/.test(phone)
    ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
    : phone || '-';
}

function maskIdentity(value?: null | string) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (text.length <= 10) {
    return text;
  }
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function displayWechatIdentity(record: { openid?: string; unionid?: string }) {
  const unionid = maskIdentity(record.unionid);
  const openid = maskIdentity(record.openid);
  if (unionid) {
    return `UnionID ${unionid}`;
  }
  if (openid) {
    return `OpenID ${openid}`;
  }
  return '-';
}

function displayCustomerName(record: {
  customerName?: string;
  openid?: string;
  phone?: string;
  unionid?: string;
}) {
  const name = String(record.customerName || '').trim();
  if (name) {
    return name;
  }
  if (record.phone) {
    return maskPhone(record.phone);
  }
  const wechatIdentity = displayWechatIdentity(record);
  return wechatIdentity === '-' ? '匿名访客' : wechatIdentity;
}

function displayExternalUserId(record: { externalUserId?: string }) {
  return maskIdentity(record.externalUserId) || '-';
}

function displayCustomerAddress(record: { customerAddress?: string }) {
  return String(record.customerAddress || '').trim() || '-';
}

function displayCustomer(record: {
  customerName?: string;
  externalUserId?: string;
  openid?: string;
  phone?: string;
}) {
  const name = String(record.customerName || '').trim();
  if (name && record.phone) {
    return `${name} ${maskPhone(record.phone)}`;
  }
  if (name) {
    return name;
  }
  if (record.phone) {
    return maskPhone(record.phone);
  }
  const wechatIdentity = displayWechatIdentity(record);
  if (wechatIdentity !== '-') {
    return wechatIdentity;
  }
  const externalUserId = displayExternalUserId(record);
  if (externalUserId !== '-') {
    return `企微 ${externalUserId}`;
  }
  return '匿名访客';
}

function resetListPage() {
  listQuery.currentPage = 1;
}

function getRowActionKey(action: string, id: number) {
  return `${action}-${id}`;
}

function isRowActionLoading(action: string, id: number) {
  return rowActionLoadingKey.value === getRowActionKey(action, id);
}

function clearListFilters() {
  listQuery.currentPage = 1;
  listQuery.keyword = '';
  listQuery.phone = '';
  listQuery.salesUserId = undefined;
  listQuery.scene = '';
  externalLogQuery.bindingId = undefined;
  externalLogQuery.state = '';
}

async function refreshSalesUserOptions(keyword = '') {
  salesUserOptionsLoading.value = true;
  try {
    const result = await getSystemUserList({
      currentPage: 1,
      pageSize: 100,
      realName: keyword,
      status: 1,
    });
    const options = (result.items || [])
      .map((item) => {
        const value = Number(item.centerUserId || item.id || 0);
        const name = String(item.realName || item.username || '').trim();
        return value > 0
          ? {
              label: name || `用户${value}`,
              value,
            }
          : null;
      })
      .filter(Boolean) as { label: string; value: number }[];

    salesUserOptions.value = options;
  } catch (error) {
    console.error('[crm] load sales user options failed:', error);
    salesUserOptions.value = [];
  } finally {
    salesUserOptionsLoading.value = false;
  }
}

async function copyText(value: string, label: string) {
  if (!value) {
    message.warning(`${label}为空`);
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    message.success(`${label}已复制`);
    return true;
  } catch {
    message.warning('浏览器不允许自动复制，请手动选中复制');
    return false;
  }
}

function getWechatShareSignUrl() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.href.split('#')[0] || window.location.href;
}

async function configureWechatShare() {
  const link = crossChannelInviteUrl.value;
  const signUrl = getWechatShareSignUrl();
  if (!link || !signUrl) {
    throw new Error('推广链接为空');
  }

  const config = await getWechatJsSdkConfig(signUrl, { debug: false });
  const initResult = await initWechatJssdk(config, {
    jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
    timeoutMs: 5000,
  });
  if (!initResult.ok || !initResult.wx) {
    throw new Error(initResult.message || '微信分享配置失败');
  }

  const applyResult = applyWechatH5ShareCard(initResult.wx, {
    desc: shareDescription.value,
    imgUrl: shareImageUrl.value,
    link,
    title: shareTitle.value,
  });
  if (!applyResult.ok) {
    throw new Error(applyResult.message || '微信分享数据设置失败');
  }
}

async function sharePromotionByWechat() {
  const link = crossChannelInviteUrl.value;
  if (!link) {
    message.warning('请先生成推广链接');
    return;
  }

  const navigatorWithShare = navigator as Navigator & {
    share?: (data: {
      text?: string;
      title?: string;
      url?: string;
    }) => Promise<void>;
  };
  if (
    !isWechatBrowser.value &&
    isMobileBrowser.value &&
    typeof navigatorWithShare.share === 'function'
  ) {
    try {
      await navigatorWithShare.share({
        text: shareDescription.value,
        title: shareTitle.value,
        url: link,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.warn('[crm] web share failed:', error);
    }
  }

  if (isWechatBrowser.value) {
    try {
      await configureWechatShare();
      message.success('微信分享已准备好，请点击右上角转发给朋友或朋友圈');
      return;
    } catch (error) {
      console.warn('[crm] wechat share config failed:', error);
      const copied = await copyText(shareText.value, '微信分享文案');
      if (copied) {
        message.warning('微信分享配置失败，已复制推广文案');
      }
      return;
    }
  }

  const copied = await copyText(shareText.value, '微信分享文案');
  if (copied) {
    message.info('PC端已复制微信分享文案，可粘贴到微信发送');
  }
}

function waitForImageReady(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    };

    timer = window.setTimeout(finish, 3000);
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
  });
}

async function waitForPosterImages() {
  if (!posterRef.value) {
    return;
  }
  const images = [...posterRef.value.querySelectorAll('img')];
  await Promise.all(images.map((image) => waitForImageReady(image)));
}

async function renderPromotionPoster() {
  if (!qrcodeImageUrl.value) {
    posterDataUrl.value = '';
    return '';
  }

  posterRendering.value = true;
  try {
    await nextTick();
    const posterElement = posterRef.value;
    if (!posterElement) {
      posterDataUrl.value = '';
      return '';
    }
    await waitForPosterImages();
    const canvas = await html2canvas(posterElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
    posterDataUrl.value = canvas.toDataURL('image/png');
    return posterDataUrl.value;
  } catch (error) {
    console.error('[crm] render promotion poster failed:', error);
    message.warning('推广海报生成失败，已保留二维码');
    posterDataUrl.value = '';
    return '';
  } finally {
    posterRendering.value = false;
  }
}

async function refreshRuntimeInfo() {
  configLoading.value = true;
  overviewLoading.value = true;
  try {
    const [config, stats] = await Promise.all([
      getCrmConfigStatusApi(),
      getCrmOverviewStatsApi(),
    ]);
    configStatus.value = config;
    overview.value = stats;
  } finally {
    configLoading.value = false;
    overviewLoading.value = false;
  }
}

async function createSalesQrcode() {
  if (!currentUserId.value) {
    message.warning('当前账号缺少销售身份，请重新登录或联系管理员');
    return;
  }

  salesLoading.value = true;
  try {
    posterDataUrl.value = '';
    inviteQrcode.value = null;
    inviteEntryError.value = '';
    const fallbackName = currentSalesName.value
      ? `${currentSalesName.value}的获客推广`
      : '默认推广渠道';
    salesResult.value = await createCrmSalesQrcodeApi({
      channelName: fallbackName,
      envVersion: 'release',
      generateWxacode: false,
      salesName: normalizeOptionalText(currentSalesName.value),
      salesUserId: currentUserId.value,
      width: 430,
    });

    const channel = salesResult.value.channel;
    inviteQrcode.value = await getCrmInviteH5QrcodeApi({
      scene: channel.scene,
      width: 430,
    });

    listQuery.scene = channel.scene;
    listQuery.salesUserId = channel.salesUserId;
    resetListPage();
    await Promise.all([refreshCrmRecords(), refreshRuntimeInfo()]);
    await renderPromotionPoster();
    message.success('推广海报已生成，客户扫码进入授权页后即可完成获客归属');
  } finally {
    salesLoading.value = false;
  }
}

function buildRecordQuery() {
  const keyword = normalizeOptionalText(listQuery.keyword);
  return {
    currentPage: listQuery.currentPage,
    keyword,
    pageSize: listQuery.pageSize,
    phone: normalizeOptionalText(listQuery.phone),
    salesUserId: listQuery.salesUserId,
    scene: normalizeOptionalText(listQuery.scene),
  };
}

async function refreshBindings() {
  bindingLoading.value = true;
  try {
    const result = await listCrmOwnerBindingsApi(buildRecordQuery());
    bindingItems.value = result.items;
    bindingTotal.value = result.total;
  } finally {
    bindingLoading.value = false;
  }
}

async function refreshScanLogs() {
  scanLogLoading.value = true;
  try {
    const result = await listCrmScanLogsApi(buildRecordQuery());
    scanLogItems.value = result.items;
    scanLogTotal.value = result.total;
  } finally {
    scanLogLoading.value = false;
  }
}

async function refreshChannels() {
  channelLoading.value = true;
  try {
    const result = await listCrmSalesChannelsApi({
      currentPage: listQuery.currentPage,
      pageSize: listQuery.pageSize,
      salesUserId: listQuery.salesUserId,
      scene: normalizeOptionalText(listQuery.scene),
    });
    channelItems.value = result.items;
    channelTotal.value = result.total;
  } finally {
    channelLoading.value = false;
  }
}

async function refreshExternalLogs() {
  externalLogLoading.value = true;
  try {
    const result = await listCrmExternalContactLogsApi({
      bindingId: externalLogQuery.bindingId,
      currentPage: listQuery.currentPage,
      keyword: normalizeOptionalText(listQuery.keyword),
      pageSize: listQuery.pageSize,
      salesUserId: listQuery.salesUserId,
      state: normalizeOptionalText(externalLogQuery.state),
    });
    externalLogItems.value = result.items;
    externalLogTotal.value = result.total;
  } finally {
    externalLogLoading.value = false;
  }
}

async function refreshCurrentTab() {
  switch (activeDataTab.value) {
    case 'bindings': {
      await refreshBindings();
      break;
    }
    case 'channels': {
      await refreshChannels();
      break;
    }
    case 'externalLogs': {
      await refreshExternalLogs();
      break;
    }
    case 'scanLogs': {
      await refreshScanLogs();
      break;
    }
  }
}

async function refreshCrmRecords() {
  await Promise.all([
    refreshBindings(),
    refreshChannels(),
    refreshExternalLogs(),
    refreshScanLogs(),
  ]);
}

async function handleTabChange() {
  resetListPage();
  await refreshCurrentTab();
}

async function handleTablePageChange(page: number, pageSize: number) {
  listQuery.currentPage = page;
  listQuery.pageSize = pageSize;
  await refreshCurrentTab();
}

function tablePagination(total: number) {
  return {
    current: listQuery.currentPage,
    onChange: handleTablePageChange,
    pageSize: listQuery.pageSize,
    showSizeChanger: true,
    showTotal: (value: number) => `共 ${value} 条`,
    total,
  };
}

async function focusChannelRecords(
  record: Partial<CrmSalesChannel>,
  tab: DataTabKey,
) {
  listQuery.phone = '';
  listQuery.keyword = '';
  listQuery.scene = record.scene || '';
  listQuery.salesUserId = Number(record.salesUserId || 0) || undefined;
  activeDataTab.value = tab;
  resetListPage();
  await refreshCurrentTab();
}

async function focusBindingScanLogs(record: Partial<CrmOwnerBinding>) {
  listQuery.phone = record.phone || '';
  listQuery.keyword = '';
  listQuery.scene = record.firstScene || '';
  listQuery.salesUserId = Number(record.ownerSalesUserId || 0) || undefined;
  activeDataTab.value = 'scanLogs';
  resetListPage();
  await refreshScanLogs();
}

async function handleSalesFilterChange() {
  resetListPage();
  await refreshCrmRecords();
}

function resetBindingForm() {
  bindingForm.id = undefined;
  bindingForm.customerAddress = '';
  bindingForm.customerName = '';
  bindingForm.phone = '';
  bindingForm.openid = '';
  bindingForm.unionid = '';
  bindingForm.externalUserId = '';
  bindingForm.ownerSalesUserId = isSuperUser.value
    ? listQuery.salesUserId || undefined
    : currentUserId.value || undefined;
  bindingForm.scene = listQuery.scene || currentScene.value || '';
}

function openCreateBindingModal() {
  resetBindingForm();
  bindingModalMode.value = 'create';
  bindingModalOpen.value = true;
  if (isSuperUser.value) {
    void refreshSalesUserOptions();
  }
}

function openEditBindingModal(record: CrmOwnerBinding) {
  bindingModalMode.value = 'edit';
  bindingForm.id = record.id;
  bindingForm.customerAddress = record.customerAddress || '';
  bindingForm.customerName = record.customerName || '';
  bindingForm.phone = record.phone || '';
  bindingForm.openid = record.openid || '';
  bindingForm.unionid = record.unionid || '';
  bindingForm.externalUserId = record.externalUserId || '';
  bindingForm.ownerSalesUserId = record.ownerSalesUserId || undefined;
  bindingForm.scene = record.firstScene || '';
  bindingModalOpen.value = true;
  if (isSuperUser.value) {
    void refreshSalesUserOptions();
  }
}

async function submitBindingForm() {
  const phone = bindingForm.phone.trim();
  const openid = bindingForm.openid.trim();
  const unionid = bindingForm.unionid.trim();

  if (!phone && !openid && !unionid) {
    message.warning('请至少填写手机号、OpenID 或 UnionID');
    return;
  }
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    message.warning('请输入正确的 11 位手机号');
    return;
  }
  if (!bindingForm.ownerSalesUserId) {
    message.warning('请选择归属销售');
    return;
  }

  const payload = {
    customerAddress: normalizeOptionalText(bindingForm.customerAddress),
    customerName: normalizeOptionalText(bindingForm.customerName),
    externalUserId: normalizeOptionalText(bindingForm.externalUserId),
    openid: normalizeOptionalText(openid),
    ownerSalesUserId: bindingForm.ownerSalesUserId,
    phone: normalizeOptionalText(phone),
    scene: normalizeOptionalText(bindingForm.scene),
    unionid: normalizeOptionalText(unionid),
  };

  bindingSaving.value = true;
  try {
    if (bindingModalMode.value === 'create') {
      await createCrmOwnerBindingApi(payload);
      message.success('客户已新增');
    } else if (bindingForm.id) {
      await updateCrmOwnerBindingApi({
        ...payload,
        id: bindingForm.id,
      });
      message.success('客户已更新');
    }
    bindingModalOpen.value = false;
    activeDataTab.value = 'bindings';
    await refreshCrmRecords();
  } finally {
    bindingSaving.value = false;
  }
}

function confirmDeleteBinding(record: CrmOwnerBinding) {
  Modal.confirm({
    centered: true,
    content: `删除后客户归属记录会移除，扫码日志仍会保留。确认删除 ${displayCustomer(
      record,
    )} 吗？`,
    okText: '删除',
    okType: 'danger',
    async onOk() {
      rowActionLoading.value = true;
      rowActionLoadingKey.value = getRowActionKey('delete', record.id);
      try {
        await deleteCrmOwnerBindingApi({
          id: record.id,
          reason: '后台手动删除',
        });
        message.success('客户已删除');
        await refreshCrmRecords();
      } finally {
        rowActionLoading.value = false;
        rowActionLoadingKey.value = '';
      }
    },
    title: '删除客户',
  });
}

function confirmBindingStatus(record: CrmOwnerBinding) {
  const nextStatus = record.status === 1 ? 0 : 1;
  Modal.confirm({
    centered: true,
    content:
      nextStatus === 1
        ? '启用后该客户归属恢复有效，后续扫码仍按首次归属处理。'
        : '停用后该客户不会计入有效客户，但扫码日志仍会保留。',
    okText: '确定',
    async onOk() {
      rowActionLoading.value = true;
      rowActionLoadingKey.value = getRowActionKey('status', record.id);
      try {
        await updateCrmOwnerBindingStatusApi({
          id: record.id,
          reason: '后台手动调整',
          status: nextStatus,
        });
        message.success(nextStatus === 1 ? '客户归属已启用' : '客户归属已停用');
        await refreshCrmRecords();
      } finally {
        rowActionLoading.value = false;
        rowActionLoadingKey.value = '';
      }
    },
    title: nextStatus === 1 ? '启用客户归属' : '停用客户归属',
  });
}

function asOwnerBinding(record: unknown) {
  return record as CrmOwnerBinding;
}

function openTransferModal(record: CrmOwnerBinding) {
  transferRecord.value = record;
  transferTargetSalesUserId.value = undefined;
  transferModalOpen.value = true;
  void refreshSalesUserOptions();
}

async function confirmTransferBinding() {
  if (!transferRecord.value) {
    return;
  }
  if (!transferTargetSalesUserId.value) {
    message.warning('请选择新的归属销售');
    return;
  }
  if (
    transferTargetSalesUserId.value === transferRecord.value.ownerSalesUserId
  ) {
    message.warning('新归属销售不能和当前销售相同');
    return;
  }

  rowActionLoading.value = true;
  rowActionLoadingKey.value = getRowActionKey(
    'transfer',
    transferRecord.value.id,
  );
  try {
    await transferCrmOwnerBindingApi({
      id: transferRecord.value.id,
      reason: '后台手动转移归属',
      toSalesUserId: transferTargetSalesUserId.value,
    });
    message.success('客户归属已转移');
    transferModalOpen.value = false;
    transferRecord.value = null;
    await refreshCrmRecords();
  } finally {
    rowActionLoading.value = false;
    rowActionLoadingKey.value = '';
  }
}

function confirmChannelStatus(record: CrmSalesChannel) {
  const nextStatus = record.status === 1 ? 0 : 1;
  Modal.confirm({
    centered: true,
    content:
      nextStatus === 1
        ? '启用后该渠道二维码可以继续获客。'
        : '停用后该渠道二维码不会再创建有效归属。',
    okText: '确定',
    async onOk() {
      rowActionLoading.value = true;
      rowActionLoadingKey.value = getRowActionKey('channel-status', record.id);
      try {
        await updateCrmSalesChannelApi({
          id: record.id,
          status: nextStatus,
        });
        message.success(nextStatus === 1 ? '渠道已启用' : '渠道已停用');
        await refreshCrmRecords();
      } finally {
        rowActionLoading.value = false;
        rowActionLoadingKey.value = '';
      }
    },
    title: nextStatus === 1 ? '启用获客渠道' : '停用获客渠道',
  });
}

function asSalesChannel(record: unknown) {
  return record as CrmSalesChannel;
}
</script>

<template>
  <Page>
    <div class="crm-qrcode-page">
      <div class="page-heading">
        <h2>获客推广</h2>
        <p>
          生成获客推广链接和二维码，发到微信、QQ、抖音、海报等渠道，客户授权后自动绑定归属销售。
        </p>
      </div>

      <Alert
        class="mb-4"
        show-icon
        type="info"
        message="推广入口只有一个：链接和二维码都进入 H5 授权页；客户微信授权后锁定归属销售，后续重复扫码只记录扫码来源，不自动改归属。"
      />

      <Row :gutter="[16, 16]" class="mb-4">
        <Col :xs="12" :md="6">
          <Card :bordered="false" class="metric-card">
            <span>渠道二维码</span>
            <strong>{{ formatNumber(overview?.channels.total) }}</strong>
            <small>启用 {{ formatNumber(overview?.channels.active) }}</small>
          </Card>
        </Col>
        <Col :xs="12" :md="6">
          <Card :bordered="false" class="metric-card">
            <span>已绑定客户</span>
            <strong>{{ formatNumber(overview?.bindings.total) }}</strong>
            <small>有效 {{ formatNumber(overview?.bindings.active) }}</small>
          </Card>
        </Col>
        <Col :xs="12" :md="6">
          <Card :bordered="false" class="metric-card">
            <span>扫码记录</span>
            <strong>{{ formatNumber(overview?.scans.total) }}</strong>
            <small>今日 {{ formatNumber(overview?.scans.today) }}</small>
          </Card>
        </Col>
        <Col :xs="12" :md="6">
          <Card :bordered="false" class="metric-card">
            <span>企微添加</span>
            <strong>{{
              formatNumber(overview?.externalContacts.total)
            }}</strong>
            <small>
              今日 {{ formatNumber(overview?.externalContacts.today) }}
            </small>
          </Card>
        </Col>
      </Row>

      <Card class="workflow-card" title="生成我的获客二维码" :bordered="false">
        <div class="generator-layout">
          <div class="form-grid">
            <div class="sales-summary">
              <span>当前销售</span>
              <strong>{{ currentSalesName || '当前账号' }}</strong>
            </div>

            <Button
              class="success-action"
              :loading="salesLoading || configLoading"
              block
              @click="createSalesQrcode"
            >
              生成二维码
            </Button>

            <div class="promotion-side-panel">
              <div class="side-panel-head">
                <span>数据范围</span>
                <Tag :color="isSuperUser ? 'gold' : 'blue'">
                  {{ isSuperUser ? '全部' : '本人' }}
                </Tag>
              </div>
              <strong>{{ crmDataScopeName }}</strong>
              <p>客户授权后会沉淀到客户归属、扫码记录、企微添加三类数据里。</p>
            </div>

            <div class="promotion-steps">
              <div>
                <span>1</span>
                <strong>销售生成海报</strong>
              </div>
              <div>
                <span>2</span>
                <strong>客户进入 H5 授权</strong>
              </div>
              <div>
                <span>3</span>
                <strong>系统锁定归属</strong>
              </div>
              <div>
                <span>4</span>
                <strong>后台查看客户</strong>
              </div>
            </div>
          </div>

          <div class="qrcode-result">
            <div
              class="poster-preview-frame"
              :class="{ 'is-empty': !qrcodeImageUrl }"
            >
              <div
                v-if="qrcodeImageUrl"
                ref="posterRef"
                class="promotion-poster"
              >
                <h3>园区管理的坑，你踩过几个？</h3>
                <div class="poster-pain-grid">
                  <div>
                    <strong>合同递增到期忘记，造成损失难挽回</strong>
                    <span>合同</span>
                  </div>
                  <div>
                    <strong>水电费挨家抄，对账对到眼花</strong>
                    <span>水电</span>
                  </div>
                  <div>
                    <strong>招商靠瞎传，房源空着没人知道</strong>
                    <span>招商</span>
                  </div>
                  <div>
                    <strong>员工考勤混乱，招投标信息总错过</strong>
                    <span>考勤</span>
                  </div>
                </div>
                <div class="poster-arrow">↓</div>
                <div class="poster-solution">“瞰维智管”一站式解决方案</div>
                <div class="poster-check-list">
                  <div>全智能化管理（资产 / 合同 / 水电 / 考勤）</div>
                  <div>合同递增到期自动提醒 + 精准招商智能获客</div>
                  <div>智能水电 + 能源管控，省人工更省电</div>
                  <div>移动在线制单，账单直达租户手机</div>
                  <div>实时招标资讯推送，不错过商机</div>
                </div>
                <div class="poster-footer">
                  <div>
                    <strong>现开放100个免费试用名额</strong>
                    <span>扫码一键授权，领取专属顾问服务</span>
                    <span>授权后下载瞰维智管继续使用</span>
                  </div>
                  <img
                    v-if="qrcodeImageUrl"
                    :src="qrcodeImageUrl"
                    alt="获客推广二维码"
                  />
                </div>
                <div class="poster-mini-title">瞰维智管</div>
              </div>
              <div v-else class="poster-empty-state">
                <strong>推广海报预览区</strong>
                <span>点击生成二维码后，这里展示可下载的完整推广海报</span>
              </div>

              <div
                v-if="salesLoading || posterRendering"
                class="poster-loading-mask"
              >
                <span>
                  {{
                    salesLoading ? '正在生成专属海报...' : '正在处理海报图片...'
                  }}
                </span>
              </div>
            </div>

            <Descriptions bordered size="small" :column="1">
              <Descriptions.Item label="归属销售">
                {{ salesResult?.channel.salesName || currentSalesName || '-' }}
              </Descriptions.Item>
            </Descriptions>

            <div class="promotion-entry-panel">
              <div class="side-panel-head">
                <span>推广入口</span>
                <Tag :color="crossChannelInviteUrl ? 'green' : 'default'">
                  {{ crossChannelInviteUrl ? inviteEntryTypeName : '待生成' }}
                </Tag>
              </div>
              <p class="invite-link-preview">
                {{ crossChannelInviteUrl || '生成二维码后自动生成推广链接' }}
              </p>
              <p class="entry-note">
                二维码和链接都进入 H5 授权页，微信内可直接微信授权绑定客户归属。
              </p>
              <p v-if="inviteEntryError" class="entry-note warning-note">
                {{ inviteEntryError }}
              </p>
            </div>

            <Space class="poster-actions" wrap>
              <Button
                type="primary"
                size="small"
                :disabled="!crossChannelInviteUrl || salesLoading"
                @click="sharePromotionByWechat"
              >
                微信分享
              </Button>
              <Button
                size="small"
                :disabled="!crossChannelInviteUrl || salesLoading"
                @click="copyText(crossChannelInviteUrl, '推广链接')"
              >
                复制链接
              </Button>
            </Space>
          </div>
        </div>
      </Card>

      <Card
        class="workflow-card data-card mt-4"
        title="获客数据"
        :bordered="false"
      >
        <div class="list-filter-grid">
          <Input
            v-model:value="listQuery.keyword"
            placeholder="按手机号 / OpenID / UnionID 查询"
            allow-clear
          />
          <Select
            v-if="isSuperUser"
            v-model:value="listQuery.salesUserId"
            class="sales-filter"
            :filter-option="false"
            :loading="salesUserOptionsLoading"
            :options="salesUserOptions"
            allow-clear
            placeholder="按销售筛选"
            show-search
            @change="handleSalesFilterChange"
            @search="refreshSalesUserOptions"
          />
          <Space wrap>
            <Button type="primary" @click="openCreateBindingModal">
              新增客户
            </Button>
            <Button :loading="recordsLoading" @click="refreshCurrentTab">
              查询
            </Button>
            <Button :loading="recordsLoading" @click="refreshCrmRecords">
              刷新全部
            </Button>
            <Button @click="clearListFilters">清空</Button>
          </Space>
        </div>

        <Tabs
          v-model:active-key="activeDataTab"
          class="crm-data-tabs"
          @change="handleTabChange"
        >
          <Tabs.TabPane key="bindings" :tab="`客户归属 ${bindingTotal}`">
            <Table
              class="desktop-data-table"
              :columns="bindingColumns"
              :data-source="bindingItems"
              :loading="bindingLoading"
              :locale="emptyTableLocale"
              :pagination="tablePagination(bindingTotal)"
              :scroll="{ x: 1680, y: 460 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'customerName'">
                  <strong>{{ displayCustomerName(record) }}</strong>
                </template>
                <template v-else-if="column.dataIndex === 'phone'">
                  {{ maskPhone(record.phone) }}
                </template>
                <template v-else-if="column.dataIndex === 'customerAddress'">
                  {{ displayCustomerAddress(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'wechatIdentity'">
                  {{ displayWechatIdentity(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'externalUserId'">
                  {{ displayExternalUserId(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'ownerSalesName'">
                  <Tag color="blue">{{ record.ownerSalesName || '-' }}</Tag>
                </template>
                <template v-else-if="column.dataIndex === 'status'">
                  <Tag :color="record.status === 1 ? 'green' : 'default'">
                    {{ record.status === 1 ? '有效' : '停用' }}
                  </Tag>
                </template>
                <template
                  v-else-if="
                    column.dataIndex === 'firstScanAt' ||
                    column.dataIndex === 'lastScanAt'
                  "
                >
                  {{ formatDate(record[column.dataIndex]) }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space>
                    <Button size="small" @click="focusBindingScanLogs(record)">
                      扫码记录
                    </Button>
                    <Button
                      size="small"
                      @click="openEditBindingModal(asOwnerBinding(record))"
                    >
                      编辑
                    </Button>
                    <Button
                      v-if="isSuperUser"
                      size="small"
                      @click="openTransferModal(asOwnerBinding(record))"
                    >
                      转移
                    </Button>
                    <Button
                      danger
                      size="small"
                      :loading="isRowActionLoading('status', record.id)"
                      @click="confirmBindingStatus(asOwnerBinding(record))"
                    >
                      {{ record.status === 1 ? '停用' : '启用' }}
                    </Button>
                    <Button
                      danger
                      size="small"
                      :loading="isRowActionLoading('delete', record.id)"
                      @click="confirmDeleteBinding(asOwnerBinding(record))"
                    >
                      删除
                    </Button>
                  </Space>
                </template>
              </template>
            </Table>
          </Tabs.TabPane>

          <Tabs.TabPane key="channels" :tab="`渠道二维码 ${channelTotal}`">
            <Table
              class="desktop-data-table"
              :columns="channelColumns"
              :data-source="channelItems"
              :loading="channelLoading"
              :locale="emptyTableLocale"
              :pagination="tablePagination(channelTotal)"
              :scroll="{ x: 1160, y: 460 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'salesName'">
                  <Tag color="blue">{{ record.salesName || '-' }}</Tag>
                </template>
                <template
                  v-else-if="
                    column.dataIndex === 'scanCount' ||
                    column.dataIndex === 'bindingCount' ||
                    column.dataIndex === 'externalContactCount'
                  "
                >
                  {{ formatNumber(record[column.dataIndex]) }}
                </template>
                <template v-else-if="column.dataIndex === 'status'">
                  <Tag :color="record.status === 1 ? 'green' : 'default'">
                    {{ record.status === 1 ? '启用' : '停用' }}
                  </Tag>
                </template>
                <template v-else-if="column.dataIndex === 'createTime'">
                  {{ formatDate(record.createTime) }}
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space>
                    <Button
                      size="small"
                      @click="focusChannelRecords(record, 'bindings')"
                    >
                      客户
                    </Button>
                    <Button
                      size="small"
                      @click="focusChannelRecords(record, 'scanLogs')"
                    >
                      扫码
                    </Button>
                    <Button
                      danger
                      size="small"
                      :loading="isRowActionLoading('channel-status', record.id)"
                      @click="confirmChannelStatus(asSalesChannel(record))"
                    >
                      {{ record.status === 1 ? '停用' : '启用' }}
                    </Button>
                  </Space>
                </template>
              </template>
            </Table>
          </Tabs.TabPane>

          <Tabs.TabPane key="scanLogs" :tab="`扫码记录 ${scanLogTotal}`">
            <Table
              class="desktop-data-table"
              :columns="scanLogColumns"
              :data-source="scanLogItems"
              :loading="scanLogLoading"
              :locale="emptyTableLocale"
              :pagination="tablePagination(scanLogTotal)"
              :scroll="{ x: 1640, y: 460 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'customerName'">
                  <strong>{{ displayCustomerName(record) }}</strong>
                </template>
                <template v-else-if="column.dataIndex === 'phone'">
                  {{ maskPhone(record.phone) }}
                </template>
                <template v-else-if="column.dataIndex === 'customerAddress'">
                  {{ displayCustomerAddress(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'wechatIdentity'">
                  {{ displayWechatIdentity(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'sourceName'">
                  <Tag color="purple">{{ record.sourceName || '-' }}</Tag>
                </template>
                <template v-else-if="column.dataIndex === 'requestedSalesName'">
                  <Tag color="default">
                    {{ record[column.dataIndex] || '-' }}
                  </Tag>
                </template>
                <template v-else-if="column.dataIndex === 'resolvedSalesName'">
                  <Tag :color="record.resolvedSalesName ? 'blue' : 'orange'">
                    {{ record.resolvedSalesName || '未留资' }}
                  </Tag>
                </template>
                <template v-else-if="column.dataIndex === 'isFirstBind'">
                  <Tag :color="record.isFirstBind ? 'green' : 'default'">
                    {{ record.isFirstBind ? '是' : '否' }}
                  </Tag>
                </template>
                <template v-else-if="column.dataIndex === 'createTime'">
                  {{ formatDate(record.createTime) }}
                </template>
              </template>
            </Table>
          </Tabs.TabPane>

          <Tabs.TabPane
            key="externalLogs"
            :tab="`企微添加 ${externalLogTotal}`"
          >
            <Table
              class="desktop-data-table"
              :columns="externalLogColumns"
              :data-source="externalLogItems"
              :loading="externalLogLoading"
              :locale="emptyTableLocale"
              :pagination="tablePagination(externalLogTotal)"
              :scroll="{ x: 1460, y: 460 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'customerName'">
                  <strong>{{ displayCustomerName(record) }}</strong>
                </template>
                <template v-else-if="column.dataIndex === 'phone'">
                  {{ maskPhone(record.phone) }}
                </template>
                <template v-else-if="column.dataIndex === 'customerAddress'">
                  {{ displayCustomerAddress(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'wechatIdentity'">
                  {{ displayWechatIdentity(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'externalUserId'">
                  {{ displayExternalUserId(record) }}
                </template>
                <template v-else-if="column.dataIndex === 'ownerSalesName'">
                  <Tag color="blue">{{ record.ownerSalesName || '-' }}</Tag>
                </template>
                <template v-else-if="column.dataIndex === 'changeType'">
                  <Tag color="blue">{{ record.changeType || '-' }}</Tag>
                </template>
                <template v-else-if="column.dataIndex === 'createTime'">
                  {{ formatDate(record.createTime) }}
                </template>
              </template>
            </Table>
          </Tabs.TabPane>
        </Tabs>

        <div class="mobile-record-list">
          <div v-if="recordsLoading" class="mobile-empty">加载中...</div>
          <div v-else-if="activeMobileItems.length === 0" class="mobile-empty">
            暂无数据
          </div>

          <template v-else-if="activeDataTab === 'bindings'">
            <article
              v-for="record in bindingItems"
              :key="`binding-${record.id}`"
              class="mobile-record-card"
            >
              <div class="mobile-card-head">
                <div>
                  <strong>{{ displayCustomer(record) }}</strong>
                  <span>{{ record.firstChannelName || '未记录来源' }}</span>
                </div>
                <Tag :color="record.status === 1 ? 'green' : 'default'">
                  {{ record.status === 1 ? '有效' : '停用' }}
                </Tag>
              </div>
              <div class="mobile-card-grid">
                <span>客户姓名</span>
                <strong>{{ displayCustomerName(record) }}</strong>
                <span>手机号</span>
                <strong>{{ maskPhone(record.phone) }}</strong>
                <span>详细地址</span>
                <strong>{{ displayCustomerAddress(record) }}</strong>
                <span>微信标识</span>
                <strong>{{ displayWechatIdentity(record) }}</strong>
                <span>企微ID</span>
                <strong>{{ displayExternalUserId(record) }}</strong>
                <span>归属销售</span>
                <strong>{{ record.ownerSalesName || '-' }}</strong>
                <span>首次绑定</span>
                <strong>{{ formatDate(record.firstScanAt) }}</strong>
                <span>最近扫码</span>
                <strong>{{ formatDate(record.lastScanAt) }}</strong>
              </div>
              <div class="mobile-card-actions">
                <Button
                  block
                  size="small"
                  @click="focusBindingScanLogs(record)"
                >
                  扫码
                </Button>
                <Button
                  block
                  size="small"
                  @click="openEditBindingModal(record)"
                >
                  编辑
                </Button>
                <Button
                  v-if="isSuperUser"
                  block
                  size="small"
                  @click="openTransferModal(record)"
                >
                  转移归属
                </Button>
                <Button
                  block
                  danger
                  size="small"
                  :loading="isRowActionLoading('status', record.id)"
                  @click="confirmBindingStatus(record)"
                >
                  {{ record.status === 1 ? '停用' : '启用' }}
                </Button>
                <Button
                  block
                  danger
                  size="small"
                  :loading="isRowActionLoading('delete', record.id)"
                  @click="confirmDeleteBinding(record)"
                >
                  删除
                </Button>
              </div>
            </article>
          </template>

          <template v-else-if="activeDataTab === 'channels'">
            <article
              v-for="record in channelItems"
              :key="`channel-${record.id}`"
              class="mobile-record-card"
            >
              <div class="mobile-card-head">
                <div>
                  <strong>{{ record.channelName || '-' }}</strong>
                  <span>{{ record.salesName || '未记录销售' }}</span>
                </div>
                <Tag :color="record.status === 1 ? 'green' : 'default'">
                  {{ record.status === 1 ? '启用' : '停用' }}
                </Tag>
              </div>
              <div class="mobile-stat-row">
                <div>
                  <span>扫码</span>
                  <strong>{{ formatNumber(record.scanCount) }}</strong>
                </div>
                <div>
                  <span>客户</span>
                  <strong>{{ formatNumber(record.bindingCount) }}</strong>
                </div>
                <div>
                  <span>企微</span>
                  <strong>
                    {{ formatNumber(record.externalContactCount) }}
                  </strong>
                </div>
              </div>
              <div class="mobile-card-actions">
                <Button
                  block
                  size="small"
                  @click="focusChannelRecords(record, 'bindings')"
                >
                  看客户
                </Button>
                <Button
                  block
                  size="small"
                  @click="focusChannelRecords(record, 'scanLogs')"
                >
                  看扫码
                </Button>
                <Button
                  block
                  danger
                  size="small"
                  @click="confirmChannelStatus(record)"
                  :loading="isRowActionLoading('channel-status', record.id)"
                >
                  {{ record.status === 1 ? '停用渠道' : '启用渠道' }}
                </Button>
              </div>
            </article>
          </template>

          <template v-else-if="activeDataTab === 'scanLogs'">
            <article
              v-for="record in scanLogItems"
              :key="`scan-${record.id}`"
              class="mobile-record-card"
            >
              <div class="mobile-card-head">
                <div>
                  <strong>{{ displayCustomer(record) }}</strong>
                  <span>{{ record.channelName || '未记录渠道' }}</span>
                </div>
                <Tag :color="record.isFirstBind ? 'green' : 'default'">
                  {{ record.isFirstBind ? '首次' : '重复' }}
                </Tag>
              </div>
              <div class="mobile-card-grid">
                <span>客户姓名</span>
                <strong>{{ displayCustomerName(record) }}</strong>
                <span>手机号</span>
                <strong>{{ maskPhone(record.phone) }}</strong>
                <span>详细地址</span>
                <strong>{{ displayCustomerAddress(record) }}</strong>
                <span>微信标识</span>
                <strong>{{ displayWechatIdentity(record) }}</strong>
                <span>扫码时间</span>
                <strong>{{ formatDate(record.createTime) }}</strong>
                <span>扫码来源</span>
                <strong>{{ record.sourceName || '-' }}</strong>
                <span>二维码销售</span>
                <strong>{{ record.requestedSalesName || '-' }}</strong>
                <span>实际归属</span>
                <strong>{{ record.resolvedSalesName || '-' }}</strong>
              </div>
            </article>
          </template>

          <template v-else>
            <article
              v-for="record in externalLogItems"
              :key="`external-${record.id}`"
              class="mobile-record-card"
            >
              <div class="mobile-card-head">
                <div>
                  <strong>{{ displayCustomer(record) }}</strong>
                  <span>{{ record.firstChannelName || '未记录来源' }}</span>
                </div>
                <Tag color="blue">{{ record.changeType || '-' }}</Tag>
              </div>
              <div class="mobile-card-grid">
                <span>客户姓名</span>
                <strong>{{ displayCustomerName(record) }}</strong>
                <span>手机号</span>
                <strong>{{ maskPhone(record.phone) }}</strong>
                <span>详细地址</span>
                <strong>{{ displayCustomerAddress(record) }}</strong>
                <span>微信标识</span>
                <strong>{{ displayWechatIdentity(record) }}</strong>
                <span>企微ID</span>
                <strong>{{ displayExternalUserId(record) }}</strong>
                <span>归属销售</span>
                <strong>{{ record.ownerSalesName || '-' }}</strong>
                <span>添加时间</span>
                <strong>{{ formatDate(record.createTime) }}</strong>
              </div>
            </article>
          </template>

          <template v-if="activeMobileItems.length > 0">
            <div class="mobile-pagination">
              <Button
                size="small"
                :disabled="listQuery.currentPage <= 1"
                @click="
                  handleTablePageChange(
                    Math.max(1, listQuery.currentPage - 1),
                    listQuery.pageSize,
                  )
                "
              >
                上一页
              </Button>
              <span>
                第 {{ listQuery.currentPage }} 页 / 共
                {{ activeMobileTotal }} 条
              </span>
              <Button
                size="small"
                :disabled="
                  listQuery.currentPage * listQuery.pageSize >=
                  activeMobileTotal
                "
                @click="
                  handleTablePageChange(
                    listQuery.currentPage + 1,
                    listQuery.pageSize,
                  )
                "
              >
                下一页
              </Button>
            </div>
          </template>
        </div>
      </Card>

      <Modal
        v-model:open="bindingModalOpen"
        :title="bindingModalTitle"
        :confirm-loading="bindingSaving"
        destroy-on-close
        @ok="submitBindingForm"
      >
        <div class="binding-form">
          <label class="field">
            <span>客户姓名</span>
            <Input
              v-model:value="bindingForm.customerName"
              allow-clear
              placeholder="请输入客户姓名"
            />
          </label>
          <label class="field">
            <span>手机号</span>
            <Input
              v-model:value="bindingForm.phone"
              allow-clear
              inputmode="tel"
              :maxlength="11"
              placeholder="请输入 11 位手机号"
            />
          </label>
          <label class="field">
            <span>详细地址</span>
            <Input.TextArea
              v-model:value="bindingForm.customerAddress"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              :maxlength="255"
              allow-clear
              placeholder="请输入客户详细地址"
              show-count
            />
          </label>
          <label v-if="isSuperUser" class="field">
            <span>归属销售</span>
            <Select
              v-model:value="bindingForm.ownerSalesUserId"
              :filter-option="false"
              :loading="salesUserOptionsLoading"
              :options="salesUserOptions"
              allow-clear
              placeholder="请选择归属销售"
              show-search
              @search="refreshSalesUserOptions"
            />
          </label>
          <label class="field">
            <span>来源 scene</span>
            <Input
              v-model:value="bindingForm.scene"
              allow-clear
              :disabled="bindingModalMode === 'edit'"
              placeholder="可选，不填则使用该销售最近的渠道"
            />
          </label>
          <label class="field">
            <span>OpenID</span>
            <Input
              v-model:value="bindingForm.openid"
              allow-clear
              placeholder="可选，微信授权后会自动写入"
            />
          </label>
          <label class="field">
            <span>UnionID</span>
            <Input
              v-model:value="bindingForm.unionid"
              allow-clear
              placeholder="可选，微信开放平台绑定后才会有"
            />
          </label>
          <label class="field">
            <span>企微客户ID</span>
            <Input
              v-model:value="bindingForm.externalUserId"
              allow-clear
              placeholder="可选，客户添加企微后可写入"
            />
          </label>
          <p class="binding-form-note">
            至少填写手机号、OpenID、UnionID
            其中一项；详细地址可由客户留资或后台维护。
          </p>
        </div>
      </Modal>

      <Modal
        v-model:open="transferModalOpen"
        title="转移客户归属"
        :confirm-loading="rowActionLoading"
        @ok="confirmTransferBinding"
      >
        <div class="transfer-form">
          <p>
            当前客户：{{
              transferRecord ? displayCustomer(transferRecord) : '-'
            }}
          </p>
          <p>当前归属：{{ transferRecord?.ownerSalesName || '-' }}</p>
          <Select
            v-model:value="transferTargetSalesUserId"
            :filter-option="false"
            :loading="salesUserOptionsLoading"
            :options="salesUserOptions"
            allow-clear
            class="w-full"
            placeholder="请选择新的归属销售"
            show-search
            @search="refreshSalesUserOptions"
          />
        </div>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.crm-qrcode-page {
  padding: 16px;
  padding-bottom: calc(var(--app-safe-area-bottom, 0px) + 16px);
}

.page-heading {
  margin-bottom: 16px;
}

.page-heading h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}

.page-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.workflow-card,
.metric-card {
  border: 1px solid hsl(var(--border));
}

.metric-card :deep(.ant-card-body) {
  display: grid;
  gap: 4px;
  padding: 16px;
}

.metric-card span,
.sales-summary span {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.metric-card strong {
  font-size: 26px;
  line-height: 1.1;
}

.metric-card small {
  color: hsl(var(--muted-foreground));
}

.generator-layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(660px, 1fr);
  gap: 20px;
  align-items: start;
}

.form-grid {
  display: grid;
  gap: 14px;
  align-self: start;
  max-width: 320px;
}

.sales-summary {
  display: grid;
  gap: 4px;
  padding: 12px;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sales-summary strong {
  font-size: 16px;
}

.promotion-entry-panel,
.promotion-side-panel,
.promotion-steps {
  padding: 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.promotion-entry-panel,
.promotion-side-panel {
  display: grid;
  gap: 8px;
  min-height: 96px;
}

.side-panel-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.side-panel-head span,
.promotion-entry-panel p,
.promotion-side-panel p {
  margin: 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.entry-note {
  color: hsl(var(--muted-foreground));
}

.warning-note {
  color: #b45309;
}

.promotion-side-panel strong {
  font-size: 15px;
  line-height: 1.4;
}

.invite-link-preview {
  min-height: 42px;
  overflow: hidden;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.promotion-steps {
  display: grid;
  gap: 10px;
}

.promotion-steps div {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.promotion-steps span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 12px;
  font-weight: 700;
  color: #166534;
  background: #dcfce7;
  border-radius: 999px;
}

.promotion-steps strong {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
}

.field {
  display: grid;
  gap: 6px;
  margin: 0;
  color: hsl(var(--foreground));
}

.field > span {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.qrcode-result {
  display: grid;
  gap: 12px;
  align-content: start;
  min-width: 0;
  min-height: 1240px;
}

.sales-filter {
  width: min(100%, 260px);
}

.binding-form,
.transfer-form {
  display: grid;
  gap: 12px;
}

.binding-form-note,
.transfer-form p {
  margin: 0;
  color: hsl(var(--muted-foreground));
}

.poster-preview-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 1080px;
  padding: 18px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 86%), rgb(243 248 255 / 92%)),
    #f3f7fb;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.promotion-poster {
  position: relative;
  width: min(100%, 720px);
  min-height: 0;
  padding: 34px 34px 24px;
  margin: 0 auto;
  overflow: hidden;
  font-family: Arial, 'Microsoft YaHei', sans-serif;
  color: #101820;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgb(15 35 70 / 12%);
}

.poster-empty-state {
  display: grid;
  gap: 10px;
  place-items: center;
  align-content: center;
  width: min(100%, 720px);
  min-height: 1000px;
  padding: 24px;
  color: #506986;
  text-align: center;
  background:
    linear-gradient(#fff, #fff) padding-box,
    repeating-linear-gradient(
        135deg,
        #d5e4f6 0,
        #d5e4f6 12px,
        #edf4fc 12px,
        #edf4fc 24px
      )
      border-box;
  border: 1px dashed transparent;
  border-radius: 10px;
}

.poster-empty-state strong {
  font-size: 22px;
  color: #173b66;
}

.poster-empty-state span {
  max-width: 320px;
  font-size: 14px;
  line-height: 1.7;
}

.promotion-poster h3 {
  margin: 0 0 26px;
  font-size: 40px;
  font-weight: 900;
  line-height: 1.25;
  color: #97020e;
  text-align: center;
}

.poster-pain-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.poster-pain-grid div {
  display: grid;
  align-content: space-between;
  min-height: 194px;
  padding: 16px 12px;
  text-align: center;
  border: 1.5px solid #111;
  border-radius: 10px;
}

.poster-pain-grid strong {
  font-size: 21px;
  font-weight: 700;
  line-height: 1.45;
}

.poster-pain-grid span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  margin: 0 auto;
  font-size: 17px;
  font-weight: 700;
  color: #0b65d8;
  background: #eef7ff;
  border: 2px solid #0b65d8;
  border-radius: 999px;
}

.poster-arrow {
  margin: 12px 0;
  font-size: 46px;
  font-weight: 800;
  line-height: 1;
  color: #0879e9;
  text-align: center;
}

.poster-solution {
  padding: 14px 8px;
  font-size: 31px;
  font-weight: 900;
  color: #fff;
  text-align: center;
  background: #0879e9;
  border-radius: 8px 8px 0 0;
}

.poster-check-list {
  display: grid;
  gap: 16px;
  padding: 28px 14px 24px;
}

.poster-check-list div {
  position: relative;
  min-height: 38px;
  padding-left: 52px;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.6;
}

.poster-check-list div::before {
  position: absolute;
  top: 1px;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  font-size: 24px;
  font-weight: 900;
  color: #fff;
  content: '✓';
  background: #0879e9;
  border-radius: 999px;
}

.poster-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148px;
  gap: 18px;
  align-items: center;
  min-height: 184px;
  padding: 18px;
  color: #fff;
  background: #0879e9;
  border-radius: 8px;
}

.poster-footer strong,
.poster-footer span {
  display: block;
}

.poster-footer strong {
  margin-bottom: 6px;
  font-size: 31px;
  color: #fff36a;
}

.poster-footer span {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.55;
}

.poster-footer img {
  width: 148px;
  height: 148px;
  padding: 6px;
  object-fit: contain;
  background: #fff;
}

.poster-mini-title {
  margin-top: 12px;
  font-size: 27px;
  font-weight: 800;
  color: #073c8c;
  text-align: center;
}

.poster-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0f3c73;
  background: rgb(244 249 255 / 68%);
  backdrop-filter: blur(2px);
}

.poster-loading-mask span {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  background: #fff;
  border: 1px solid #c9dcf5;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgb(15 35 70 / 12%);
}

.poster-actions {
  min-height: 32px;
}

.list-filter-grid {
  display: grid;
  grid-template-columns: minmax(180px, 320px) auto;
  gap: 8px;
  align-items: center;
}

.data-card {
  min-height: 60vh;
}

.crm-data-tabs {
  margin-top: 12px;
}

.crm-data-tabs :deep(.ant-tabs-content-holder) {
  min-height: 500px;
}

.mobile-record-list {
  display: none;
}

.success-action {
  font-weight: 600;
  color: #fff;
  background: #16a34a;
  border-color: #16a34a;
}

.success-action:hover,
.success-action:focus {
  color: #fff;
  background: #15803d;
  border-color: #15803d;
}

@media (max-width: 1280px) {
  .generator-layout {
    grid-template-columns: 1fr;
  }

  .form-grid {
    max-width: none;
  }

  .promotion-poster {
    width: min(100%, 720px);
  }
}

@media (max-width: 768px) {
  .crm-qrcode-page {
    padding: 12px 12px calc(var(--app-safe-area-bottom, 0px) + 16px);
  }

  .page-heading h2 {
    font-size: 18px;
  }

  .page-heading p {
    font-size: 13px;
  }

  .metric-card :deep(.ant-card-body) {
    padding: 12px;
  }

  .metric-card strong {
    font-size: 22px;
  }

  .workflow-card :deep(.ant-card-body) {
    padding: 14px;
  }

  .form-grid {
    gap: 10px;
  }

  .promotion-side-panel,
  .promotion-steps {
    display: none;
  }

  .qrcode-result {
    gap: 8px;
    min-height: 0;
  }

  .poster-preview-frame {
    align-items: flex-start;
    min-height: 210px;
    max-height: min(42vh, 340px);
    padding: 8px;
    overflow: auto;
  }

  .poster-empty-state {
    min-height: 280px;
    padding: 16px;
  }

  .poster-empty-state strong {
    font-size: 18px;
  }

  .poster-empty-state span {
    font-size: 13px;
  }

  .promotion-poster {
    width: min(100%, 280px);
    min-height: auto;
    padding: 8px 7px 7px;
    border-radius: 8px;
  }

  .promotion-poster h3 {
    margin-bottom: 6px;
    font-size: 15px;
  }

  .poster-pain-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .poster-pain-grid div {
    min-height: 58px;
    padding: 5px 4px;
  }

  .poster-pain-grid strong {
    font-size: 10px;
    line-height: 1.25;
  }

  .poster-pain-grid span {
    width: 24px;
    height: 24px;
    font-size: 10px;
  }

  .poster-arrow {
    margin: 2px 0;
    font-size: 16px;
  }

  .poster-solution {
    padding: 5px 6px;
    font-size: 12px;
  }

  .poster-check-list {
    gap: 3px;
    padding: 6px 4px;
  }

  .poster-check-list div {
    min-height: 16px;
    padding-left: 20px;
    font-size: 9px;
    line-height: 1.25;
  }

  .poster-check-list div::before {
    width: 14px;
    height: 14px;
    font-size: 10px;
  }

  .poster-footer {
    grid-template-columns: minmax(0, 1fr) 56px;
    gap: 5px;
    min-height: 66px;
    padding: 6px;
  }

  .poster-footer strong {
    margin-bottom: 2px;
    font-size: 10px;
  }

  .poster-footer span {
    font-size: 8px;
    line-height: 1.25;
  }

  .poster-footer img {
    width: 56px;
    height: 56px;
    padding: 3px;
  }

  .poster-mini-title {
    margin-top: 3px;
    font-size: 11px;
  }

  .promotion-entry-panel {
    min-height: 0;
    padding: 10px;
  }

  .invite-link-preview {
    min-height: 0;
    max-height: 48px;
    font-size: 12px;
  }

  .qrcode-result :deep(.ant-space) {
    width: 100%;
  }

  .qrcode-result :deep(.ant-space-item),
  .qrcode-result :deep(.ant-btn),
  .qrcode-result a {
    width: 100%;
  }

  .poster-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-height: 0;
  }

  .poster-actions :deep(.ant-space-item) {
    width: auto;
  }

  .poster-actions :deep(.ant-btn) {
    height: 36px;
  }

  .list-filter-grid {
    grid-template-columns: 1fr;
  }

  .list-filter-grid :deep(.ant-space) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .list-filter-grid :deep(.ant-space-item),
  .list-filter-grid :deep(.ant-btn) {
    width: 100%;
  }

  .list-filter-grid :deep(.ant-btn) {
    height: 36px;
    padding-inline: 4px;
  }

  .crm-data-tabs :deep(.ant-tabs-nav) {
    margin-bottom: 10px;
  }

  .crm-data-tabs :deep(.ant-tabs-tab) {
    padding: 8px 0;
    font-size: 13px;
  }

  .crm-data-tabs :deep(.ant-tabs-content-holder) {
    display: none;
  }

  .desktop-data-table {
    display: none;
  }

  .mobile-record-list {
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }

  .mobile-record-card,
  .mobile-empty {
    padding: 10px;
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    border-radius: 8px;
  }

  .mobile-empty {
    color: hsl(var(--muted-foreground));
    text-align: center;
  }

  .mobile-card-head {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .mobile-card-head > div {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .mobile-card-head strong,
  .mobile-card-head span,
  .mobile-card-grid strong {
    overflow-wrap: anywhere;
  }

  .mobile-card-head strong {
    font-size: 14px;
  }

  .mobile-card-head span,
  .mobile-card-grid span,
  .mobile-stat-row span,
  .mobile-pagination {
    font-size: 12px;
    color: hsl(var(--muted-foreground));
  }

  .mobile-card-grid {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 5px 8px;
    margin: 8px 0;
  }

  .mobile-card-grid strong {
    font-size: 12px;
    font-weight: 500;
  }

  .mobile-stat-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 8px 0;
  }

  .mobile-stat-row > div {
    display: grid;
    gap: 2px;
    padding: 8px;
    background: hsl(var(--muted) / 35%);
    border-radius: 8px;
  }

  .mobile-stat-row strong {
    font-size: 16px;
    line-height: 1.1;
  }

  .mobile-card-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .mobile-card-actions :deep(.ant-btn) {
    min-width: 0;
    height: 32px;
    padding-inline: 4px;
    font-size: 12px;
  }

  .mobile-pagination {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 4px 0;
    text-align: center;
  }
}

@media (max-width: 420px) {
  .list-filter-grid :deep(.ant-space) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-card-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
