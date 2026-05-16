<script setup lang="ts">
import type {
  AttendanceConfig,
  AttendanceDeviceAbnormalLog,
  AttendanceDeviceAbnormalType,
  AttendanceDeviceAction,
  AttendanceDeviceDecision,
  AttendanceDeviceInfo,
  AttendanceLeaveScope,
  TodayAttendanceRecord,
} from '#/api/hrm/attendance';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useUserStore } from '@vben/stores';

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Icon } from '@iconify/vue';
import {
  Button,
  Input,
  List,
  message,
  Modal,
  Space,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  changeAttendanceDevice,
  getAttendanceConfig,
  getAttendanceDeviceAbnormalList,
  getAttendanceDeviceStatus,
  getOfficeLocations,
  getTodayRecord,
  punchIn,
  punchOut,
  sendAttendanceDeviceChangeCode,
} from '#/api/hrm/attendance';
import { useLayoutStore } from '#/store/layout';
import { getBaiduMapAk, loadBaiduMapScript } from '#/utils/map';

// ================================= 类型定义 =================================
interface TodayRecord extends TodayAttendanceRecord {
  workHours: number;
}

interface OfficeLocation {
  lat: number;
  lng: number;
  name: string;
  radius: number;
}

// ================================= 考勤状态 =================================
const AttendanceStatus = {
  Absent: 4,
  EarlyLeave: 2,
  Late: 1,
  LateAndEarlyLeave: 3,
  Leave: 5,
  Normal: 0,
} as const;

const attendanceStatusMeta = {
  [AttendanceStatus.Absent]: { color: 'red', text: '缺勤' },
  [AttendanceStatus.EarlyLeave]: { color: 'orange', text: '早退' },
  [AttendanceStatus.Late]: { color: 'red', text: '迟到' },
  [AttendanceStatus.LateAndEarlyLeave]: { color: 'red', text: '迟到+早退' },
  [AttendanceStatus.Leave]: { color: 'blue', text: '请假' },
  [AttendanceStatus.Normal]: { color: 'green', text: '正常' },
};

const leaveScopeMeta: Record<
  Exclude<AttendanceLeaveScope, 'none'>,
  { color: string; text: string }
> = {
  full: { color: 'blue', text: '整天请假' },
  partial: { color: 'cyan', text: '部分请假' },
};

const deviceRecordStatusMeta: Record<
  'abnormal' | 'normal',
  { color: string; text: string }
> = {
  abnormal: { color: 'red', text: '设备异常' },
  normal: { color: 'green', text: '考勤设备正常' },
};

const defaultAttendanceConfig: AttendanceConfig = {
  scheduledCheckIn: '09:00:00',
  scheduledCheckOut: '18:00:00',
  source: 'default',
};

const deviceAbnormalTypePriority = [
  'device_changed',
  'same_device_multi_account',
];

const deviceAbnormalTypeMeta: Record<
  string,
  { reason: string; reminder: string; text: string }
> = {
  device_changed: {
    reason:
      '当前设备标识与账号已绑定设备不一致，可能是更换手机，或 App 数据清理、卸载重装、WebView 存储丢失后重新生成了设备标识',
    reminder:
      '更换设备打卡：当前设备与账号已绑定设备不一致，可能是更换手机，也可能是清除 App 数据、卸载重装或 WebView 存储丢失导致设备标识重新生成。请核实设备归属，确认本人设备后点击考勤设备更换，进行手机号短信验证。',
    text: '更换设备打卡',
  },
  same_device_multi_account: {
    reason: '当前设备已被多个账号用于打卡',
    reminder:
      '同设备多账号：当前设备已被其他账号绑定或使用，存在代打卡风险，请核实设备归属。',
    text: '同设备多账号',
  },
};

// ================================= 响应式数据 =================================
const currentLocation = ref('');
const latitude = ref(0);
const longitude = ref(0);
const isInRange = ref(false);
const locationLoading = ref(true);
const punchLoading = ref(false);
const mapInitialized = ref(false);
const deviceInfo = ref<AttendanceDeviceInfo | null>(null);
const attendanceDeviceDecision = ref<AttendanceDeviceDecision | null>(null);
const deviceChanging = ref(false);
const deviceAbnormalLogs = ref<AttendanceDeviceAbnormalLog[]>([]);
const deviceAbnormalLoading = ref(false);
const deviceDecisionModalVisible = ref(false);
const deviceSmsCode = ref('');
const deviceSmsCountdown = ref(0);
const deviceSmsError = ref('');
const deviceSmsModalVisible = ref(false);
const deviceSmsSending = ref(false);
const deviceSmsSubmitting = ref(false);
const deviceSmsTargetDevice = ref<AttendanceDeviceInfo | null>(null);
const deviceSmsVerifyPhone = ref('');
const deviceIdStorageKey = 'attendance_device_id';
const nativeDeviceIdFilePath = 'attendance/device-id.txt';
const pendingDeviceDecision = ref<AttendanceDeviceDecision | null>(null);
let deviceSmsCountdownTimer: number | undefined;
let deviceSmsResolver: ((value: boolean) => void) | null = null;
let deviceDecisionResolver: ((value: boolean) => void) | null = null;

// Pinia Store
const userStore = useUserStore();
const userInfo = userStore.userInfo;

const router = useRouter();
const layoutStore = useLayoutStore();

// 打卡点
const officeLocations = ref<OfficeLocation[]>([]);
const attendanceConfig = ref<AttendanceConfig>(defaultAttendanceConfig);
const isAttendanceConfigLoaded = ref(false);

// 今日打卡记录
const todayRecord = ref<null | TodayRecord>(null);
const isTodayRecordLoaded = ref(false);

// 地图相关
let map: any = null;
const currentMarker = ref<any>(null);
const officeCircles = ref<any[]>([]);
const locateFn = ref<(() => void) | null>(null);
let geolocation: any = null;

// 生命周期
onMounted(async () => {
  layoutStore.setHeaderActions([
    {
      icon: 'mdi:history',
      key: 'history',
      onClick: () => {
        router.push({
          path: '/hrm/attendance/record',
        });
      },
    },
  ]);
  layoutStore.setOnRefresh(() => handleRelocate());
  await initMap();
});

onUnmounted(() => {
  layoutStore.clearHeaderActions();
  layoutStore.setOnRefresh(null);
  if (map) {
    map = null;
    mapInitialized.value = false;
  }
  locateFn.value = null;
  geolocation = null;
  clearDeviceSmsCountdownTimer();
});

const getUsername = () => {
  const username = userStore.userInfo?.realName;
  if (!username) {
    throw new Error('未获取到用户信息，请重新登录');
  }
  return username;
};

const getCurrentAccountPhone = () => {
  const accountInfo = userStore.userInfo as
    | null
    | (Record<string, unknown> & {
        mobile?: unknown;
        phone?: unknown;
        phoneNumber?: unknown;
        username?: unknown;
      })
    | undefined;
  const phone = String(
    accountInfo?.phone ?? accountInfo?.phoneNumber ?? accountInfo?.mobile ?? '',
  ).trim();
  if (/^\d{11}$/.test(phone)) {
    return phone;
  }

  const username = String(accountInfo?.username ?? '').trim();
  return /^\d{11}$/.test(username) ? username : '';
};

const confirmModal = (options: {
  content: string;
  okText: string;
  title: string;
}) => {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      centered: true,
      content: options.content,
      okText: options.okText,
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: options.title,
    });
  });
};

const createRandomHex = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return [...bytes].map((item) => item.toString(16).padStart(2, '0')).join('');
};

const readNativeDeviceId = async () => {
  try {
    const result = await Filesystem.readFile({
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      path: nativeDeviceIdFilePath,
    });
    return typeof result.data === 'string' ? result.data.trim() : '';
  } catch {
    return '';
  }
};

const writeNativeDeviceId = async (deviceId: string) => {
  await Filesystem.writeFile({
    data: deviceId,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    path: nativeDeviceIdFilePath,
    recursive: true,
  });
};

const createStableDeviceId = async () => {
  const isNativeApp = Capacitor.isNativePlatform();
  if (isNativeApp) {
    const nativeStored = await readNativeDeviceId();
    if (nativeStored) {
      return nativeStored;
    }

    const legacyStored = window.localStorage.getItem(deviceIdStorageKey);
    const deviceId = legacyStored || `app-${createRandomHex()}`;
    try {
      await writeNativeDeviceId(deviceId);
    } catch {
      window.localStorage.setItem(deviceIdStorageKey, deviceId);
      return deviceId;
    }
    window.localStorage.setItem(deviceIdStorageKey, deviceId);
    return deviceId;
  }

  const stored = window.localStorage.getItem(deviceIdStorageKey);
  if (stored) {
    return stored;
  }

  const deviceId = `web-${createRandomHex()}`;
  window.localStorage.setItem(deviceIdStorageKey, deviceId);
  return deviceId;
};

const loadCurrentDeviceInfo = async () => {
  const platform = Capacitor.getPlatform();
  const userAgent = window.navigator.userAgent;
  const stableDeviceId = await createStableDeviceId();
  const deviceSystem = [
    platform,
    window.navigator.platform,
    window.navigator.language,
  ]
    .filter(Boolean)
    .join(' / ');

  deviceInfo.value = {
    deviceId: stableDeviceId,
    deviceLabel: `${platform || 'web'} ${window.navigator.platform}`,
    deviceModel: window.navigator.platform || userAgent.slice(0, 80),
    deviceSystem,
    platform,
    userAgent,
  };

  return deviceInfo.value;
};

const getCurrentDeviceInfo = async () => {
  return deviceInfo.value ?? (await loadCurrentDeviceInfo());
};

const formatDeviceDisplay = (
  device?: null | Pick<AttendanceDeviceInfo, 'deviceId'>,
) => {
  if (!device) {
    return '-';
  }
  const deviceId = String(device.deviceId || '').trim();
  return deviceId || '-';
};

const normalizeDeviceAbnormalTypes = (
  abnormalTypes?: AttendanceDeviceAbnormalType[],
) => {
  const normalizedTypes = [
    ...new Set(
      (abnormalTypes ?? [])
        .flatMap((type) => String(type || '').split(','))
        .map((type) => type.trim())
        .filter(Boolean),
    ),
  ];

  return [
    ...deviceAbnormalTypePriority.filter((type) =>
      normalizedTypes.includes(type),
    ),
    ...normalizedTypes.filter(
      (type) => !deviceAbnormalTypePriority.includes(type),
    ),
  ];
};

const getDeviceAbnormalTypeSet = (
  abnormalTypes?: AttendanceDeviceAbnormalType[],
) => {
  return new Set(normalizeDeviceAbnormalTypes(abnormalTypes));
};

const getDeviceAbnormalTypeNames = (
  abnormalTypes?: AttendanceDeviceAbnormalType[],
) => {
  return normalizeDeviceAbnormalTypes(abnormalTypes).map(
    (type) => deviceAbnormalTypeMeta[type]?.text || '设备异常',
  );
};

const getDeviceDecisionReminderText = (
  abnormalTypes?: AttendanceDeviceAbnormalType[],
) => {
  const types = normalizeDeviceAbnormalTypes(abnormalTypes);
  const reminders = types.map(
    (type) =>
      deviceAbnormalTypeMeta[type]?.reminder ||
      '设备异常：当前设备校验异常，请核实后再继续打卡。',
  );
  if (types.length > 1) {
    reminders.unshift(
      `检测到${getDeviceAbnormalTypeNames(types).join('、')}：`,
    );
  }
  return reminders.join('\n');
};

const pendingDeviceDecisionTitle = computed(() => {
  const names = getDeviceAbnormalTypeNames(
    pendingDeviceDecision.value?.abnormalTypes,
  );
  if (names.length > 0) {
    return `${names.join('、')}提醒`;
  }
  return '设备异常提示';
});

const canChangeDeviceFromDecision = computed(() => {
  const types = getDeviceAbnormalTypeSet(
    pendingDeviceDecision.value?.abnormalTypes,
  );
  return types.has('device_changed');
});

const pendingDeviceDecisionActionText = computed(() => {
  return '考勤设备更换';
});

const formatDuplicateUserNames = (decision: AttendanceDeviceDecision) => {
  return decision.duplicateUsers
    .map((item) => item.realName || item.username || `用户${item.userId}`)
    .filter(Boolean)
    .join('、');
};

const getDeviceDecisionDetailLines = (
  decision: AttendanceDeviceDecision,
  abnormalType: string,
) => {
  if (abnormalType === 'device_changed') {
    return [
      `已绑定设备：${formatDeviceDisplay(decision.binding)}`,
      `当前设备：${formatDeviceDisplay(decision.device)}`,
    ];
  }

  if (abnormalType === 'same_device_multi_account') {
    return [
      `当前设备已绑定账号：${formatDuplicateUserNames(decision) || '-'}`,
      `当前账号已绑定设备：${formatDeviceDisplay(decision.binding)}`,
    ];
  }

  return [];
};

const pendingDeviceDecisionContent = computed(() => {
  const decision = pendingDeviceDecision.value;
  if (!decision) {
    return '';
  }
  const types = normalizeDeviceAbnormalTypes(decision.abnormalTypes);
  const detailLines = types.flatMap((type) =>
    getDeviceDecisionDetailLines(decision, type),
  );
  const reminderText = getDeviceDecisionReminderText(decision.abnormalTypes);
  return [reminderText || decision.message, ...detailLines]
    .filter(Boolean)
    .join('\n');
});

const deviceSmsSendText = computed(() => {
  if (deviceSmsSending.value) {
    return '发送中...';
  }
  return deviceSmsCountdown.value > 0
    ? `${deviceSmsCountdown.value}秒后重发`
    : '发送验证码';
});

const deviceSmsSubmitDisabled = computed(() => {
  return deviceSmsCode.value.trim().length !== 6 || deviceSmsSubmitting.value;
});

const deviceSmsSubmitText = computed(() => {
  return '确认更换';
});

const deviceSmsVerificationTip = computed(() => {
  if (deviceSmsError.value) {
    return deviceSmsError.value;
  }
  return `验证通过后将把考勤设备更换为 ${formatDeviceDisplay(
    deviceSmsTargetDevice.value,
  )}`;
});

const clearDeviceSmsCountdownTimer = () => {
  if (deviceSmsCountdownTimer) {
    window.clearTimeout(deviceSmsCountdownTimer);
    deviceSmsCountdownTimer = undefined;
  }
};

const startDeviceSmsCountdown = () => {
  clearDeviceSmsCountdownTimer();
  if (deviceSmsCountdown.value <= 0) {
    return;
  }

  deviceSmsCountdownTimer = window.setTimeout(() => {
    deviceSmsCountdown.value -= 1;
    startDeviceSmsCountdown();
  }, 1000);
};

const resolveDeviceSmsModal = (value: boolean) => {
  deviceSmsModalVisible.value = false;
  deviceSmsTargetDevice.value = null;
  deviceSmsCode.value = '';
  deviceSmsError.value = '';
  deviceSmsSubmitting.value = false;
  deviceSmsSending.value = false;
  clearDeviceSmsCountdownTimer();
  deviceSmsResolver?.(value);
  deviceSmsResolver = null;
};

const updateDeviceSmsCode = (value: string) => {
  deviceSmsCode.value = value.replaceAll(/\D/g, '').slice(0, 6);
  deviceSmsError.value = '';
};

const sendDeviceSmsCode = async () => {
  if (deviceSmsSending.value || deviceSmsCountdown.value > 0) return;

  deviceSmsSending.value = true;
  try {
    const data = await sendAttendanceDeviceChangeCode();
    deviceSmsVerifyPhone.value = data.phoneNumber;
    deviceSmsCountdown.value = 60;
    startDeviceSmsCountdown();
    message.success(`验证码已发送至 ${data.phoneNumber}`);
  } catch (error: any) {
    deviceSmsError.value = error?.message || '验证码发送失败，请稍后重试';
  } finally {
    deviceSmsSending.value = false;
  }
};

const submitDeviceSmsVerification = async () => {
  const device = deviceSmsTargetDevice.value;
  if (!device) {
    deviceSmsError.value = '未获取到当前设备信息，请重新操作';
    return;
  }
  if (deviceSmsCode.value.length !== 6) {
    deviceSmsError.value = '请输入6位短信验证码';
    return;
  }

  deviceSmsSubmitting.value = true;
  try {
    attendanceDeviceDecision.value = await changeAttendanceDevice({
      device,
      smsCode: deviceSmsCode.value,
    });
    deviceInfo.value = device;
    await loadAttendanceDeviceDecision();
    resolveDeviceSmsModal(true);
  } catch (error: any) {
    deviceSmsError.value = error?.message || '验证码校验失败，请重试';
  } finally {
    deviceSmsSubmitting.value = false;
  }
};

const openDeviceSmsVerification = async (device: AttendanceDeviceInfo) => {
  deviceSmsTargetDevice.value = device;
  deviceSmsCode.value = '';
  deviceSmsError.value = '';
  deviceSmsVerifyPhone.value = getCurrentAccountPhone();
  deviceSmsCountdown.value = 0;
  deviceSmsModalVisible.value = true;

  const promise = new Promise<boolean>((resolve) => {
    deviceSmsResolver = resolve;
  });
  return promise;
};

const loadAttendanceDeviceDecision = async () => {
  try {
    const device = await getCurrentDeviceInfo();
    attendanceDeviceDecision.value = await getAttendanceDeviceStatus({
      device,
    });
  } catch (error) {
    console.error('加载打卡设备信息失败:', error);
    attendanceDeviceDecision.value = null;
  }
};

const replaceCurrentAttendanceDevice = async () => {
  const device = await loadCurrentDeviceInfo();
  const decision = await getAttendanceDeviceStatus({ device });
  const secondOk = await confirmModal({
    content: `是否更换为当前设备？\n绑定设备：${formatDeviceDisplay(decision.binding)}\n当前设备：${formatDeviceDisplay(decision.device)}${formatDuplicateUsers(decision)}`,
    okText: '确认更换',
    title: '确认更换设备',
  });
  if (!secondOk) return false;

  return openDeviceSmsVerification(device);
};

const getDeviceErrorStatus = (error: any) => {
  return error?.response?.data?.error?.deviceStatus as
    | AttendanceDeviceDecision
    | undefined;
};

const formatDuplicateUsers = (decision: AttendanceDeviceDecision) => {
  const names = formatDuplicateUserNames(decision);
  return names.length > 0 ? `\n已绑定账号：${names}` : '';
};

const closeDeviceDecisionModal = (value: boolean) => {
  deviceDecisionModalVisible.value = false;
  pendingDeviceDecision.value = null;
  deviceDecisionResolver?.(value);
  deviceDecisionResolver = null;
};

const handleCancelDeviceDecision = () => {
  closeDeviceDecisionModal(false);
};

const handleContinueDeviceDecision = () => {
  closeDeviceDecisionModal(true);
};

const handleChangeDeviceFromDecision = async () => {
  if (deviceChanging.value) return;

  deviceChanging.value = true;
  try {
    const changed = await replaceCurrentAttendanceDevice();
    if (changed) {
      message.success('考勤设备更换成功，请重新点击打卡');
      closeDeviceDecisionModal(false);
    }
  } catch (error: any) {
    console.error('更换考勤设备失败:', error);
    message.error(`更换考勤设备失败: ${error?.message || '请重试'}`);
  } finally {
    deviceChanging.value = false;
  }
};

const confirmDeviceAbnormalDecision = (decision: AttendanceDeviceDecision) => {
  pendingDeviceDecision.value = decision;
  deviceDecisionModalVisible.value = true;
  return new Promise<boolean>((resolve) => {
    deviceDecisionResolver = resolve;
  });
};

const confirmDeviceDecision = async (decision: AttendanceDeviceDecision) => {
  const boundDeviceText = decision.binding
    ? `\n已绑定设备：${formatDeviceDisplay(decision.binding)}`
    : '';
  const currentDeviceText = `\n当前设备：${formatDeviceDisplay(
    decision.device,
  )}`;

  if (decision.status !== 'abnormal') {
    return confirmModal({
      content: `${decision.message}${boundDeviceText}${currentDeviceText}${formatDuplicateUsers(decision)}`,
      okText: decision.status === 'bind_required' ? '绑定并打卡' : '继续打卡',
      title:
        decision.status === 'bind_required' ? '绑定打卡设备' : '设备异常提示',
    });
  }

  return confirmDeviceAbnormalDecision(decision);
};

const resolveDevicePunchOptions = async () => {
  const device = await getCurrentDeviceInfo();
  const decision = await getAttendanceDeviceStatus({ device });

  if (decision.status === 'normal') {
    return {
      allowDeviceAbnormal: false,
      bindCurrentDevice: false,
      device,
    };
  }

  const ok = await confirmDeviceDecision(decision);
  if (!ok) {
    return null;
  }

  return {
    allowDeviceAbnormal: decision.status === 'abnormal',
    bindCurrentDevice: decision.status === 'bind_required',
    device,
  };
};

const loadDeviceAbnormalLogs = async () => {
  deviceAbnormalLoading.value = true;
  try {
    const data = await getAttendanceDeviceAbnormalList({
      date: dayjs().format('YYYY-MM-DD'),
      limit: 10,
    });
    deviceAbnormalLogs.value = data.items;
  } catch (error) {
    console.error('加载设备异常记录失败:', error);
  } finally {
    deviceAbnormalLoading.value = false;
  }
};

const handleDevicePunchError = async (error: any) => {
  const decision = getDeviceErrorStatus(error);
  if (!decision) {
    message.error(`打卡失败: ${error?.message || '请重试'}`);
    return;
  }

  const ok = await confirmDeviceDecision(decision);
  if (!ok) return;
  message.warning('设备状态已变化，请重新点击打卡');
};

const confirmOutsideRange = async () => {
  return confirmModal({
    content: '当前区域非指定打卡区域，是否继续打卡',
    okText: '确认打卡',
    title: '非指定区域',
  });
};

const confirmEarlyLeave = async () => {
  const now = dayjs();
  const endTime = dayjs(
    `${now.format('YYYY-MM-DD')} ${attendanceConfig.value.scheduledCheckOut}`,
  );
  if (!now.isBefore(endTime)) {
    return true;
  }
  return confirmModal({
    content: '当前时间早于规定下班时间，确定要打卡吗？',
    okText: '确认打卡',
    title: '早退确认',
  });
};

const locateOnce = async () => {
  if (!mapInitialized.value || !map || !geolocation) {
    throw new Error('地图未初始化');
  }

  locationLoading.value = true;
  return new Promise<void>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (result: any) => {
        if (geolocation.getStatus() === (window as any).BMAP_STATUS_SUCCESS) {
          updateLocationDetails(result.point);
          locationLoading.value = false;
          resolve();
          return;
        }

        currentLocation.value = '定位失败';
        locationLoading.value = false;
        reject(new Error('定位失败，请检查设备权限或网络连接'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  });
};

const handleRelocate = async () => {
  try {
    await locateOnce();
  } catch (error: any) {
    message.error(error?.message || '定位失败');
  }
};

// 初始化地图
const initMap = async () => {
  mapInitialized.value = false;
  await nextTick();
  if (!document.querySelector('#map-container')) return;
  officeCircles.value = [];
  currentMarker.value = null;
  geolocation = null;
  const container = document.querySelector(
    '#map-container',
  ) as HTMLElement | null;
  if (container) {
    container.innerHTML = '';
  }

  try {
    officeLocations.value = await getOfficeLocations();
  } catch (error) {
    console.error('Failed to fetch office locations:', error);
    message.error('获取办公室位置失败，请刷新重试');
    return;
  }

  try {
    const baiduMapAk = await getBaiduMapAk();
    await loadBaiduMapScript(baiduMapAk);
  } catch (error) {
    console.error('Baidu Map script failed to load:', {
      error,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    });
    const errMsg =
      error instanceof Error
        ? error.message
        : '地图脚本加载失败，请检查网络后重试';
    message.error(errMsg);
    locationLoading.value = false;
    return;
  }

  const BMap = (window as any).BMap;
  map = new BMap.Map('map-container');

  const points = officeLocations.value.map(
    (loc) => new BMap.Point(loc.lng, loc.lat),
  );

  officeLocations.value.forEach((loc, index) => {
    const circle = new BMap.Circle(points[index], loc.radius, {
      fillColor: '#1890ff',
      fillOpacity: 0.2,
      strokeColor: '#1890ff',
      strokeWeight: 1,
    });
    map.addOverlay(circle);
    officeCircles.value.push(circle);
  });

  map.setViewport(points);
  mapInitialized.value = true;

  // 这是用于程序化调用的核心定位服务
  geolocation = new BMap.Geolocation();

  // 统一定位逻辑
  const locate = () => {
    void handleRelocate();
  };
  locateFn.value = locate;

  // 创建自定义定位控件
  function CustomLocationControl(this: any) {
    this.defaultAnchor = (window as any).BMAP_ANCHOR_BOTTOM_RIGHT;
    this.defaultOffset = new BMap.Size(20, 20);
  }
  CustomLocationControl.prototype = new (window as any).BMap.Control();
  CustomLocationControl.prototype.initialize = function (mapInstance: any) {
    const controlDiv = document.createElement('div');
    controlDiv.style.width = '38px';
    controlDiv.style.height = '38px';
    controlDiv.style.background = 'white';
    controlDiv.style.borderRadius = '2px';
    controlDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,.15)';
    controlDiv.style.cursor = 'pointer';
    controlDiv.style.display = 'flex';
    controlDiv.style.alignItems = 'center';
    controlDiv.style.justifyContent = 'center';

    // 使用了一个开源的 crosshair 图标
    controlDiv.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>';

    controlDiv.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      locate();
    });

    mapInstance.getContainer().append(controlDiv);
    return controlDiv;
  };

  // 添加自定义控件到地图
  const customLocationCtrl = new (CustomLocationControl as any)();
  map.addControl(customLocationCtrl);

  // 页面加载时执行初次定位
  locate();
};

// 更新位置相关的所有状态
const updateLocationDetails = (point: any) => {
  const BMap = (window as any).BMap;
  if (!BMap) {
    console.error('BMap not available in updateLocationDetails');
    return;
  }
  if (!map) {
    return;
  }
  latitude.value = point.lat;
  longitude.value = point.lng;

  const geoc = new BMap.Geocoder();
  geoc.getLocation(point, (rs: any) => {
    const addComp = rs.addressComponents;
    const addressParts = [
      addComp.province,
      addComp.city,
      addComp.district,
      addComp.street,
      addComp.streetNumber,
    ];

    const uniqueParts: string[] = [];
    for (const part of addressParts) {
      if (part && uniqueParts.at(-1) !== part) {
        uniqueParts.push(part);
      }
    }
    currentLocation.value = uniqueParts.join(',');
  });

  let inRange = false;
  for (const loc of officeLocations.value) {
    const officePoint = new BMap.Point(loc.lng, loc.lat);
    const distance = map.getDistance(officePoint, point);
    if (distance <= loc.radius) {
      inRange = true;
      break;
    }
  }

  isInRange.value = inRange;
  updateMapMarkers(point);
};

// 更新地图标记
const updateMapMarkers = (point: any) => {
  if (currentMarker.value) {
    currentMarker.value.setPosition(point);
  } else {
    const BMap = (window as any).BMap;
    currentMarker.value = new BMap.Marker(point);
    map.addOverlay(currentMarker.value);
  }
  map.centerAndZoom(point, 17);
};

const getPunchPayload = () => ({
  latitude: latitude.value,
  longitude: longitude.value,
  punchTime: dayjs().toISOString(),
  username: getUsername(),
});

// 上班打卡
const handlePunchIn = async () => {
  if (punchLoading.value) return;
  try {
    await locateOnce();
  } catch {}

  if (!isInRange.value) {
    const ok = await confirmOutsideRange();
    if (!ok) return;
  }

  const deviceOptions = await resolveDevicePunchOptions();
  if (!deviceOptions) return;

  punchLoading.value = true;
  try {
    await punchIn({
      ...getPunchPayload(),
      ...deviceOptions,
    });
    await loadTodayRecord();
    await loadAttendanceDeviceDecision();
    await loadDeviceAbnormalLogs();
    message.success('上班打卡成功');
  } catch (error: any) {
    await handleDevicePunchError(error);
  } finally {
    punchLoading.value = false;
  }
};

// 下班打卡
const handlePunchOut = async () => {
  if (!todayRecord.value?.attendanceId) {
    message.error('无法找到今日打卡记录，无法下班打卡');
    return;
  }

  if (punchLoading.value) return;
  try {
    await locateOnce();
  } catch {}

  if (!isInRange.value) {
    const ok = await confirmOutsideRange();
    if (!ok) return;
  }

  const okEarlyLeave = await confirmEarlyLeave();
  if (!okEarlyLeave) return;

  const deviceOptions = await resolveDevicePunchOptions();
  if (!deviceOptions) return;

  punchLoading.value = true;
  try {
    await punchOut(todayRecord.value.attendanceId, {
      ...getPunchPayload(),
      ...deviceOptions,
    });
    await loadTodayRecord();
    await loadAttendanceDeviceDecision();
    await loadDeviceAbnormalLogs();
    message.success('下班打卡成功');
  } catch (error: any) {
    await handleDevicePunchError(error);
  } finally {
    punchLoading.value = false;
  }
};

const getStatusInfo = (status: null | number) => {
  if (
    status === null ||
    !Object.prototype.hasOwnProperty.call(attendanceStatusMeta, status)
  ) {
    return attendanceStatusMeta[AttendanceStatus.Absent];
  }
  return attendanceStatusMeta[status as keyof typeof attendanceStatusMeta];
};

const getLeaveScopeInfo = (leaveScope: AttendanceLeaveScope) => {
  if (leaveScope === 'none') {
    return null;
  }
  return leaveScopeMeta[leaveScope];
};

const getDeviceRecordStatusInfo = (
  record?: Pick<TodayAttendanceRecord, 'deviceAbnormalTypes' | 'deviceStatus'>,
) => {
  if (record?.deviceStatus !== 'abnormal') {
    return deviceRecordStatusMeta.normal;
  }
  const abnormalText = getDeviceAbnormalTypesText(record.deviceAbnormalTypes);
  return {
    color: deviceRecordStatusMeta.abnormal.color,
    text: abnormalText || deviceRecordStatusMeta.abnormal.text,
  };
};

const shouldShowDeviceStatusInPunchIn = (record: TodayRecord) => {
  return Boolean(record.punchIn && !record.punchOut);
};

const shouldShowDeviceStatusInPunchOut = (record: TodayRecord) => {
  return Boolean(record.punchOut);
};

const getDeviceAbnormalTypesText = (
  abnormalTypes?: AttendanceDeviceAbnormalType[],
) => {
  const names = getDeviceAbnormalTypeNames(abnormalTypes);
  return names.length > 0 ? names.join('、') : '';
};

const getDeviceAbnormalReasonText = (
  abnormalTypes?: AttendanceDeviceAbnormalType[],
) => {
  const reasons = normalizeDeviceAbnormalTypes(abnormalTypes).map(
    (type) => deviceAbnormalTypeMeta[type]?.reason || '当前设备校验异常',
  );
  return reasons.join('；');
};

const getActionText = (action: AttendanceDeviceAction | string) => {
  return action === 'punch_out' ? '下班打卡' : '上班打卡';
};

const formatLogTime = (value: null | string) => {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
};

const loadAttendanceConfig = async () => {
  try {
    attendanceConfig.value = await getAttendanceConfig();
  } catch (error) {
    console.error('加载考勤配置失败:', error);
    attendanceConfig.value = { ...defaultAttendanceConfig };
  } finally {
    isAttendanceConfigLoaded.value = true;
  }
};

// 加载今日记录
const loadTodayRecord = async () => {
  if (!userInfo?.realName) return; // 如果没有 username，则不执行

  try {
    const data = await getTodayRecord({ username: userInfo.realName });
    if (data) {
      todayRecord.value = {
        ...data,
        punchIn: data.punchIn ? dayjs(data.punchIn).format('HH:mm:ss') : '',
        punchOut: data.punchOut ? dayjs(data.punchOut).format('HH:mm:ss') : '',
        workHours: 0, // 初始化
      };

      if (data.punchIn && data.punchOut) {
        const punchInTime = dayjs(data.punchIn);
        const punchOutTime = dayjs(data.punchOut);
        const workHours = punchOutTime.diff(punchInTime, 'hour', true);
        if (todayRecord.value) {
          todayRecord.value.workHours = Math.round(workHours * 100) / 100;
        }
      }
    } else {
      todayRecord.value = null;
    }
    isTodayRecordLoaded.value = true; // 标记已加载
  } catch (error: any) {
    console.error('加载今日记录失败:', error);
    message.error(`加载今日记录失败: ${error.message || '未知错误'}`);
  }
};

// 监听 username 的变化，一旦获取到有效的 username，就加载所有相关数据
watch(
  () => userInfo?.realName,
  (newUsername, oldUsername) => {
    if (newUsername && newUsername !== oldUsername) {
      isAttendanceConfigLoaded.value = false;
      attendanceConfig.value = { ...defaultAttendanceConfig };
      isTodayRecordLoaded.value = false;
      todayRecord.value = null;
    }
    if (newUsername && !isAttendanceConfigLoaded.value) {
      loadAttendanceConfig();
    }
    if (newUsername && !isTodayRecordLoaded.value) {
      loadTodayRecord();
      loadDeviceAbnormalLogs();
    }
  },
  { immediate: true }, // 立即执行一次，以处理 username 已存在的情况
);

watch(
  () => userInfo?.id,
  (newUserId) => {
    if (!newUserId) return;
    loadAttendanceDeviceDecision();
  },
  { immediate: true },
);
</script>

<template>
  <div class="box-border h-full bg-[#f5f5f5] p-6">
    <!-- 打卡区域 -->
    <div class="rounded-lg bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_10%)]">
      <div class="mb-6">
        <div
          class="flex items-center rounded-lg border-2 border-[#f0f0f0] p-4 transition-all duration-300"
          :class="isInRange ? 'border-[#52c41a] bg-[#f6ffed]' : ''"
        >
          <Icon icon="mdi:map-marker" class="mr-3 text-2xl text-[#1890ff]" />
          <div class="flex-1">
            <div class="mb-1 text-base font-medium text-[#333]">
              <span v-if="locationLoading">正在定位中...</span>
              <span v-else>{{ currentLocation }}</span>
            </div>
            <div class="text-sm text-[#666]">
              <span v-if="locationLoading">请稍候...</span>
              <span v-else>{{
                isInRange ? '在打卡范围内' : '不在打卡范围内'
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        id="map-container"
        class="mb-6 h-[300px] overflow-hidden rounded-[6px] border border-[#d9d9d9]"
      ></div>

      <div class="mb-6 flex justify-center gap-4">
        <Button
          type="primary"
          size="large"
          class="punch-btn !flex !h-[60px] !flex-1 !items-center !justify-center !gap-2 !rounded-lg !border-none !bg-[linear-gradient(135deg,#52c41a,#73d13d)] !text-base"
          :disabled="Boolean(todayRecord?.punchIn)"
          :loading="punchLoading"
          @click="handlePunchIn"
        >
          <Icon icon="mdi:clock-in" />
          上班打卡
        </Button>
        <Button
          type="primary"
          size="large"
          class="punch-btn !flex !h-[60px] !flex-1 !items-center !justify-center !gap-2 !rounded-lg !border-none !bg-[linear-gradient(135deg,#1890ff,#40a9ff)] !text-base"
          :disabled="
            Boolean(!todayRecord?.attendanceId || todayRecord?.punchOut)
          "
          :loading="punchLoading"
          @click="handlePunchOut"
        >
          <Icon icon="mdi:clock-out" />
          下班打卡
        </Button>
      </div>

      <!-- 今日打卡记录 -->
      <div v-if="todayRecord" class="border-t border-[#f0f0f0] pt-4">
        <div
          v-if="todayRecord.punchIn"
          class="mb-2 flex flex-wrap items-start gap-x-3 gap-y-2"
        >
          <span class="min-w-20 font-medium text-[#333]">上班时间:</span>
          <span
            class="font-[Monaco,Menlo,monospace] font-medium text-[#1890ff]"
          >
            {{ todayRecord.punchIn }}
          </span>
          <Tag :color="getStatusInfo(todayRecord.status).color">
            {{ getStatusInfo(todayRecord.status).text }}
          </Tag>
          <Tag
            v-if="getLeaveScopeInfo(todayRecord.leaveScope)"
            :color="getLeaveScopeInfo(todayRecord.leaveScope)?.color"
          >
            {{ getLeaveScopeInfo(todayRecord.leaveScope)?.text }}
          </Tag>
          <Tag
            v-if="shouldShowDeviceStatusInPunchIn(todayRecord)"
            class="punch-device-status-tag"
            :color="getDeviceRecordStatusInfo(todayRecord).color"
          >
            {{ getDeviceRecordStatusInfo(todayRecord).text }}
          </Tag>
        </div>
        <div
          v-if="todayRecord.punchOut"
          class="mb-2 flex flex-wrap items-start gap-x-3 gap-y-2"
        >
          <span class="min-w-20 font-medium text-[#333]">下班时间:</span>
          <span
            class="font-[Monaco,Menlo,monospace] font-medium text-[#1890ff]"
          >
            {{ todayRecord.punchOut }}
          </span>
          <Tag
            v-if="shouldShowDeviceStatusInPunchOut(todayRecord)"
            class="punch-device-status-tag"
            :color="getDeviceRecordStatusInfo(todayRecord).color"
          >
            {{ getDeviceRecordStatusInfo(todayRecord).text }}
          </Tag>
        </div>
        <div v-if="todayRecord.workHours" class="mb-2 flex items-center gap-3">
          <span class="min-w-20 font-medium text-[#333]">工作时长:</span>
          <span
            class="font-[Monaco,Menlo,monospace] font-medium text-[#1890ff]"
          >
            {{ todayRecord.workHours }}小时
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="deviceAbnormalLogs.length > 0"
      class="mt-4 rounded-lg bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_10%)]"
    >
      <div class="mb-4 flex items-center justify-between">
        <div class="text-base font-medium text-[#333]">设备异常信息</div>
        <Button
          size="small"
          :loading="deviceAbnormalLoading"
          @click="loadDeviceAbnormalLogs"
        >
          刷新
        </Button>
      </div>
      <List
        :data-source="deviceAbnormalLogs"
        :loading="deviceAbnormalLoading"
        item-layout="vertical"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <Tag color="orange">
                  {{
                    getDeviceAbnormalTypesText(
                      item.abnormalTypes || [item.abnormalType],
                    )
                  }}
                </Tag>
                <span class="font-medium text-[#333]">
                  {{ getActionText(item.action) }}
                </span>
                <span class="text-sm text-[#999]">
                  {{ formatLogTime(item.createTime) }}
                </span>
              </div>
              <div class="grid gap-1 text-xs text-[#999] sm:grid-cols-2">
                <div>绑定设备：{{ item.boundDeviceId || '-' }}</div>
                <div>当前设备：{{ item.currentDeviceId }}</div>
                <div v-if="item.duplicateUserNames">
                  关联账号：{{ item.duplicateUserNames }}
                </div>
                <div
                  v-if="
                    getDeviceAbnormalReasonText(
                      item.abnormalTypes || [item.abnormalType],
                    )
                  "
                  class="sm:col-span-2"
                >
                  异常原因：{{
                    getDeviceAbnormalReasonText(
                      item.abnormalTypes || [item.abnormalType],
                    )
                  }}
                </div>
              </div>
            </div>
          </List.Item>
        </template>
      </List>
    </div>

    <Modal
      v-model:open="deviceDecisionModalVisible"
      centered
      :title="pendingDeviceDecisionTitle"
      :closable="false"
      :mask-closable="false"
      @cancel="handleCancelDeviceDecision"
    >
      <div class="whitespace-pre-line text-sm leading-6 text-[#333]">
        {{ pendingDeviceDecisionContent }}
      </div>
      <template #footer>
        <Space>
          <Button @click="handleCancelDeviceDecision">取消</Button>
          <Button
            v-if="canChangeDeviceFromDecision"
            :loading="deviceChanging"
            @click="handleChangeDeviceFromDecision"
          >
            {{ pendingDeviceDecisionActionText }}
          </Button>
          <Button type="primary" @click="handleContinueDeviceDecision">
            继续打卡
          </Button>
        </Space>
      </template>
    </Modal>

    <Modal
      v-model:open="deviceSmsModalVisible"
      centered
      title="短信验证"
      :closable="false"
      :mask-closable="false"
      wrap-class-name="attendance-device-sms-modal"
      @cancel="resolveDeviceSmsModal(false)"
    >
      <div class="space-y-4">
        <div class="rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
          <div class="text-xs text-[#64748b]">当前账号手机号</div>
          <div class="mt-1 text-base font-semibold text-[#111827]">
            {{ deviceSmsVerifyPhone || '未获取到手机号' }}
          </div>
        </div>

        <div>
          <div class="mb-2 text-sm font-medium text-[#333]">验证码</div>
          <div class="flex gap-2">
            <Input
              :value="deviceSmsCode"
              inputmode="numeric"
              :maxlength="6"
              placeholder="请输入6位验证码"
              @change="
                updateDeviceSmsCode(($event.target as HTMLInputElement).value)
              "
              @input="
                updateDeviceSmsCode(($event.target as HTMLInputElement).value)
              "
              @press-enter="submitDeviceSmsVerification"
            />
            <Button
              class="shrink-0"
              :disabled="deviceSmsCountdown > 0"
              :loading="deviceSmsSending"
              @click="sendDeviceSmsCode"
            >
              {{ deviceSmsSendText }}
            </Button>
          </div>
          <div
            class="mt-2 min-h-5 text-xs"
            :class="deviceSmsError ? 'text-[#dc2626]' : 'text-[#64748b]'"
          >
            {{ deviceSmsVerificationTip }}
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex gap-3">
          <Button class="flex-1" @click="resolveDeviceSmsModal(false)">
            取消
          </Button>
          <Button
            type="primary"
            class="flex-1"
            :disabled="deviceSmsSubmitDisabled"
            :loading="deviceSmsSubmitting"
            @click="submitDeviceSmsVerification"
          >
            {{ deviceSmsSubmitText }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.punch-device-status-tag {
  max-width: 100%;
  word-break: break-all;
  white-space: normal;
}

:deep(.attendance-device-sms-modal .ant-modal-content) {
  overflow: hidden;
  border-radius: 10px;
}

:deep(.attendance-device-sms-modal .ant-modal-footer) {
  margin-top: 18px;
}
</style>
