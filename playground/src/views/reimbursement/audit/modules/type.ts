import type {
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'ant-design-vue/es/table/interface';

import type { Park } from '#/components/AreaSelector.vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { message, Modal } from 'ant-design-vue';

import { getRoleList } from '#/api';
import { getVisitorParkList } from '#/api/park';
import {
  deleteReimbursement as apiDeleteReimbursement,
  getReimbursementList as apiGetReimbursementList,
  updateReimbursement as apiUpdateReimbursement,
} from '#/api/reimbursement';

// 从data.ts导入审核人等级映射
import { AUDITOR_LEVEL_MAP } from '../data';

/**
 * 报销记录项类型定义
 * 注意: 此处定义与data.ts中的相似，但包含了一些不同的字段
 * 建议将来将这两处定义统一
 */
export interface ReimbursementItem {
  amount: number;
  auditorLevel?: number; // Add missing auditorLevel property
  createTime?: string;
  date: string;
  department: string;
  id: number | string;
  images?: string[];
  park: string;
  payee: string;
  purpose: string;
  remark?: string;
  status: number;
  updateTime?: string;
  username?: string;
}

/**
 * 状态映射定义
 * 注意: 此处的文本与data.ts中定义的有差异
 * 建议与data.ts中的STATUS_MAP保持一致
 */
export const STATUS_MAP = {
  0: { color: 'warning', text: '待审核' },
  1: { color: 'success', text: '董事长审核通过' },
  2: { color: 'error', text: '已拒绝' },
  3: { color: 'processing', text: '园区经理审核通过' },
  4: { color: 'processing', text: '总经理审核通过' },
};

// 状态选项
export const statusOptions = [
  { label: '待审核', value: 0 },
  { label: '董事长审核通过', value: 1 },
  { label: '已拒绝', value: 2 },
  { label: '园区经理审核通过', value: 3 },
  { label: '总经理审核通过', value: 4 },
];

// 权限等级定义
export const PRIVILEGE_LEVELS = {
  CHAIRMAN: 4, // 董事长 - 三级审核
  DIRECTOR: 3, // 总监 - 二级审核
  NO_AUDIT: 0, // 无审核权限
  PARK_MANAGER: 2, // 园区经理 - 一级审核
};

/**
 * 获取审核等级对应的文本描述
 * @param level 审核权限等级
 * @returns 权限等级的文本描述
 */
export function getPrivilegeLevelText(level: number): string {
  switch (level) {
    case PRIVILEGE_LEVELS.CHAIRMAN: {
      return '董事长';
    }
    case PRIVILEGE_LEVELS.DIRECTOR: {
      return '总监';
    }
    case PRIVILEGE_LEVELS.PARK_MANAGER: {
      return '园区经理';
    }
    default: {
      return '无审核权限';
    }
  }
}

/**
 * 获取用户可审核的最大金额
 * @param level 审核权限等级
 * @returns 可审核的最大金额，-1表示无限制
 */
export function getMaxAuditAmount(level: number): number {
  switch (level) {
    case PRIVILEGE_LEVELS.CHAIRMAN: {
      return -1;
    } // 无限制
    case PRIVILEGE_LEVELS.DIRECTOR: {
      return 20_000;
    }
    case PRIVILEGE_LEVELS.PARK_MANAGER: {
      return 10_000;
    }
    default: {
      return 0;
    }
  }
}

/**
 * 验证并格式化金额
 * @param amount 要验证的金额
 * @returns 包含验证结果和格式化后金额的对象
 */
function validateAmount(amount: any): { valid: boolean; value: number } {
  const numAmount = Number.parseFloat(String(amount));
  return {
    valid: !Number.isNaN(numAmount),
    value: numAmount,
  };
}

/**
 * 获取用户可读的权限等级信息
 * @param level 用户权限等级
 * @returns 包含权限文本和可审核金额的对象
 */
export function getUserPrivilegeInfo(level: number): {
  maxAmount: string;
  text: string;
} {
  const text = getPrivilegeLevelText(level);
  const amount = getMaxAuditAmount(level);

  return {
    maxAmount: amount === -1 ? '无限制' : `${amount}元以下`,
    text,
  };
}

/**
 * 报销审核逻辑钩子
 * 提供报销审核相关的状态和方法
 */
export function useReimbursementAudit() {
  // 获取用户信息和权限
  const userStore = useUserStore();

  // 存储角色权限等级映射
  const rolePrivilegeLevels = ref<Record<string, number>>({});

  // 获取角色权限等级
  async function fetchRolePrivilegeLevels() {
    try {
      // 添加分页参数，解决 Prisma 错误
      const roles = await getRoleList({
        page: 1,
        pageSize: 100, // 设置一个足够大的值以获取所有角色
      });
      const levelMap: Record<string, number> = {};

      // 从返回的数据结构中获取角色列表
      const roleList = Array.isArray(roles)
        ? roles
        : (roles as any)?.items || [];

      if (Array.isArray(roleList)) {
        roleList.forEach((role) => {
          // 使用 privilege_level 字段作为权限等级
          if (
            role.name &&
            (role.privilege_level !== undefined || role.level !== undefined)
          ) {
            // 优先使用 privilege_level，如果不存在则使用 level
            levelMap[role.name] =
              role.privilege_level === undefined
                ? role.level
                : role.privilege_level;
          }
        });
      }

      rolePrivilegeLevels.value = levelMap;
    } catch (error) {
      console.error('获取角色权限等级失败:', error);
      message.error('获取角色权限等级失败，将使用默认权限等级');
    }
  }

  // 计算当前用户的权限等级
  const userPrivilegeLevel = computed(() => {
    // 从用户角色中获取权限等级，默认为0（无审核权限）
    const userRoles = userStore.userRoles || [];

    // 获取用户所有角色中的最高权限等级
    let maxLevel = PRIVILEGE_LEVELS.NO_AUDIT;

    for (const role of userRoles) {
      const level =
        rolePrivilegeLevels.value[role] || PRIVILEGE_LEVELS.NO_AUDIT;
      if (level > maxLevel) {
        maxLevel = level;
      }
    }

    return maxLevel;
  });

  // 判断用户是否有审核权限
  const hasAuditPermission = computed(() => {
    return userPrivilegeLevel.value >= PRIVILEGE_LEVELS.PARK_MANAGER;
  });

  // 获取可用的审核状态选项
  const availableStatusOptions = computed(() => {
    // 根据用户权限等级过滤状态选项
    if (userPrivilegeLevel.value >= PRIVILEGE_LEVELS.CHAIRMAN) {
      // 董事长可以直接通过或拒绝
      return statusOptions.filter((option) => [1, 2].includes(option.value));
    } else if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.DIRECTOR) {
      // 总监可以提交到三级审核或拒绝
      return statusOptions.filter((option) => [2, 4].includes(option.value));
    } else if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.PARK_MANAGER) {
      // 园区经理可以提交到二级审核或拒绝
      return statusOptions.filter((option) => [2, 3].includes(option.value));
    }

    return [];
  });

  // 园区列表
  const parkList = ref<Park[]>([]);

  // 获取园区列表
  async function fetchParkList() {
    try {
      const result = await getVisitorParkList({ area: 'all' });
      parkList.value = result || [];
    } catch (error) {
      console.error('获取园区列表失败:', error);
      message.error('获取园区列表失败');
    }
  }

  // 表格数据
  const tableData = ref<ReimbursementItem[]>([]);
  const reimbursementList = ref<ReimbursementItem[]>([]);
  const loading = ref(false);
  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 筛选条件
  const filterForm = reactive<{
    dateRange: any[];
    department: string | undefined;
    parkId: number | undefined;
    purpose: string;
    status: number | undefined;
  }>({
    dateRange: [],
    department: undefined,
    parkId: undefined,
    purpose: '',
    status: undefined,
  });

  // 搜索表单 - 此处在list.vue中使用
  const searchForm = reactive({
    dateRange: [],
    purpose: '',
    status: undefined,
    username: '',
  });

  // 重置搜索 - 此处在list.vue中使用
  function resetSearch() {
    searchForm.dateRange = [];
    searchForm.purpose = '';
    searchForm.status = undefined;
    searchForm.username = '';
    pagination.current = 1;
    fetchReimbursements();
  }

  // 审核表单 - 此处在list.vue中使用
  const auditForm = reactive({
    reason: '',
    status: undefined,
  });

  // 审核对话框
  const auditModalVisible = ref(false);
  const isAuditModalVisible = ref(false); // list.vue中使用
  const currentRecord = ref<null | ReimbursementItem>(null);
  const auditStatus = ref<number>(0);
  const auditRemark = ref('');
  const auditLoading = ref(false);
  const submitting = ref(false); // list.vue中使用

  // 获取报销列表数据 - 为了在list.vue中使用，提供一个别名
  const fetchReimbursements = fetchReimbursementList;

  // 获取报销列表数据
  async function fetchReimbursementList() {
    loading.value = true;
    try {
      const params: Record<string, any> = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
      };

      // 添加检索条件
      if (searchForm.purpose) {
        params.purpose = searchForm.purpose;
      }

      if (searchForm.status !== undefined) {
        params.status = searchForm.status;
      }

      // 日期范围
      if (searchForm.dateRange && searchForm.dateRange.length === 2) {
        params.startDate = searchForm.dateRange[0].format('YYYY-MM-DD');
        params.endDate = searchForm.dateRange[1].format('YYYY-MM-DD');
      }

      // 只有具有审核权限的人才能查看全部用户的申请
      if (!hasAuditPermission.value) {
        // 非审核人员只能查看自己的申请
        params.username = userStore.userInfo?.username;
      } else if (searchForm.username) {
        // 审核人员可以按用户名筛选
        params.username = searchForm.username;
      }

      const result = await apiGetReimbursementList(params);
      // 处理返回数据的不同格式
      const items = Array.isArray(result) ? result : result.items || [];
      const total =
        typeof result.total === 'number' ? result.total : items.length;

      // 转换到组件使用的格式
      const reimbursementItems = items.map((item: any) => ({
        ...item,
        // 确保日期字段存在
        date: item.date || item.createTime,
        // 如果 park 是对象，则取 parkName 属性
        park: typeof item.park === 'object' ? item.park.parkName : item.park,
      }));

      // 更新表格数据
      tableData.value = reimbursementItems;
      reimbursementList.value = reimbursementItems;
      pagination.total = total;
    } catch (error) {
      console.error('获取报销列表失败:', error);
      message.error('获取报销列表失败');
    } finally {
      loading.value = false;
    }
  }

  // 分页、排序变化处理
  function handleTableChange(
    pag: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter:
      | SorterResult<ReimbursementItem>
      | SorterResult<ReimbursementItem>[],
    _extra: TableCurrentDataSource<ReimbursementItem>,
  ) {
    pagination.current = pag.current || 1;
    pagination.pageSize = pag.pageSize || 10;
    fetchReimbursementList();
  }

  // 重置筛选条件
  function resetFilters() {
    filterForm.dateRange = [];
    filterForm.department = undefined;
    filterForm.parkId = undefined;
    filterForm.purpose = '';
    filterForm.status = undefined;

    pagination.current = 1;
    fetchReimbursementList();
  }

  // 处理搜索
  function handleSearch() {
    pagination.current = 1;
    fetchReimbursementList();
  }

  // 处理审核提交
  async function handleAuditSubmit(formRef: any) {
    // 如果是查看已审核的记录，直接关闭弹窗
    if (currentRecord.value && currentRecord.value.status > 0) {
      isAuditModalVisible.value = false;
      return;
    }

    try {
      // 表单验证
      await formRef.validate();
      submitting.value = true;

      if (!currentRecord.value) {
        message.error('未找到当前记录');
        return;
      }

      if (auditForm.status === undefined) {
        message.error('请选择审核结果');
        return;
      }

      // 验证金额
      const { valid, value } = validateAmount(currentRecord.value.amount);
      if (!valid) {
        message.error('报销金额格式不正确');
        return;
      }

      // 获取记录ID并确保是数字类型
      const recordId = Number(currentRecord.value.id);
      if (Number.isNaN(recordId)) {
        message.error('记录ID无效');
        return;
      }

      // 二次校验用户权限与金额
      if (
        userPrivilegeLevel.value === PRIVILEGE_LEVELS.PARK_MANAGER &&
        value > 10_000
      ) {
        message.error(`园区经理只能审核10000元以下的报销申请`);
        return;
      }

      if (
        userPrivilegeLevel.value === PRIVILEGE_LEVELS.DIRECTOR &&
        value > 20_000
      ) {
        message.error(`总监只能审核20000元以下的报销申请`);
        return;
      }

      const auditResult = {
        // 其他必要信息
        amount: value,
        // 添加审核人信息
        auditor: userStore.userInfo?.username,
        auditor_level: userPrivilegeLevel.value, // 使用下划线命名匹配数据库字段
        auditorId: userStore.userInfo?.userId,
        auditorLevel: userPrivilegeLevel.value, // 保留驼峰命名兼容前端展示
        reason: auditForm.reason,
        status: auditForm.status,
      };

      // 将ID作为第一个参数传递，而不是包含在数据对象中
      const res = await apiUpdateReimbursement(recordId, auditResult);

      if (res) {
        message.success('审核完成');
        isAuditModalVisible.value = false;
        // 重置表单
        auditForm.status = undefined;
        auditForm.reason = '';
        // 刷新列表
        fetchReimbursementList();
      }
    } catch (error) {
      console.error('审核失败:', error);
      message.error('审核失败，请重试');
    } finally {
      submitting.value = false;
    }
  }

  // 显示审核弹窗
  function showAuditModal(record: ReimbursementItem) {
    currentRecord.value = record;

    // 重置审核表单
    auditForm.status = undefined;
    auditForm.reason = '';

    isAuditModalVisible.value = true;
  }

  // 打开审核弹窗 (兼容旧代码)
  function openAuditModal(record: ReimbursementItem) {
    if (!record) {
      message.error('记录不存在');
      return;
    }

    // 检查是否有审核权限
    if (!hasAuditPermission.value) {
      message.error('你没有审核权限');
      return;
    }

    // 检查记录是否已经被审核
    if (record.status !== 0) {
      message.info('该记录已经被审核过');
      // 可以选择展示审核详情
      currentRecord.value = record;
      auditModalVisible.value = true;
      return;
    }

    // 权限检查，确定该用户是否能审核此申请
    const canAudit = checkAuditPermission(record);
    if (!canAudit) {
      // 如果没有审核权限，显示提示
      const levelText = getPrivilegeLevelText(userPrivilegeLevel.value);
      message.error(`你的权限(${levelText})不足以审核此申请`);
      return;
    }

    // 重置审核表单状态
    auditStatus.value = 0;
    auditRemark.value = '';

    // 将记录存储到当前记录
    currentRecord.value = record;
    // 显示审核弹窗
    auditModalVisible.value = true;
  }

  // 检查用户是否有权限审核该记录
  function checkAuditPermission(record: ReimbursementItem): boolean {
    // 如果已经审核过了，不能再次审核
    if (record.status !== 0) {
      return false;
    }

    // 根据用户角色和权限等级判断是否有审核权限
    // 这里简化，实际中可能需要更复杂的业务规则

    // 董事长有最高权限，可以审核所有申请
    if (userPrivilegeLevel.value >= PRIVILEGE_LEVELS.CHAIRMAN) {
      return true;
    }

    // 总监可以审核金额低于限额的申请
    if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.DIRECTOR) {
      // 总监权限限制在20000元以下
      return (
        record.amount <= 20_000 ||
        // 或者是园区经理已经审核通过的申请
        record.status === 3
      );
    }

    // 园区经理只能审核自己园区的，且金额较小的申请
    if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.PARK_MANAGER) {
      // 园区经理权限限制在10000元以下
      return record.amount <= 10_000;
    }

    // 其他情况不能审核
    return false;
  }

  // 提交审核
  async function submitAudit() {
    if (!currentRecord.value) {
      message.error('未找到当前记录');
      return;
    }

    if (!auditStatus.value) {
      message.error('请选择审核结果');
      return;
    }

    auditLoading.value = true;

    try {
      // 金额验证
      const { valid, value } = validateAmount(currentRecord.value.amount);
      if (!valid) {
        message.error('报销金额格式不正确');
        auditLoading.value = false;
        return;
      }

      // 获取记录ID并确保是数字类型
      const recordId = Number(currentRecord.value.id);
      if (Number.isNaN(recordId)) {
        message.error('记录ID无效');
        return;
      }

      // 二次校验用户权限与金额
      if (
        userPrivilegeLevel.value === PRIVILEGE_LEVELS.PARK_MANAGER &&
        value > 10_000
      ) {
        message.error(`园区经理只能审核10000元以下的报销申请`);
        auditLoading.value = false;
        return;
      }

      if (
        userPrivilegeLevel.value === PRIVILEGE_LEVELS.DIRECTOR &&
        value > 20_000
      ) {
        message.error(`总监只能审核20000元以下的报销申请`);
        auditLoading.value = false;
        return;
      }

      // 构建审核结果数据
      const auditData = {
        amount: value,
        // 添加审核人信息
        auditor: userStore.userInfo?.username,
        auditor_level: userPrivilegeLevel.value, // 使用下划线命名匹配数据库字段
        auditorId: userStore.userInfo?.userId,
        auditorLevel: userPrivilegeLevel.value, // 保留驼峰命名兼容前端展示
        reason: auditRemark.value, // 使用 reason 字段保持一致
        remark: auditRemark.value, // 后端可能使用 remark 字段
        status: auditStatus.value,
      };

      // 调用更新接口，将ID作为第一个参数传递
      const result = await apiUpdateReimbursement(recordId, auditData);

      if (result) {
        message.success('审核成功');
        // 关闭弹窗
        auditModalVisible.value = false;
        // 刷新列表
        await fetchReimbursementList();
      } else {
        message.error('审核失败，请重试');
      }
    } catch (error) {
      console.error('审核失败:', error);
      message.error('审核失败，请重试');
    } finally {
      auditLoading.value = false;
    }
  }

  // 删除报销记录
  async function handleDelete(record: ReimbursementItem) {
    Modal.confirm({
      content: `确定要删除此报销记录吗？这个操作不可逆。`,
      async onOk() {
        try {
          if (!record || !record.id) {
            message.error('记录ID无效');
            return;
          }

          const result = await apiDeleteReimbursement(Number(record.id));

          if (result) {
            message.success('删除成功');
            // 刷新列表
            await fetchReimbursementList();
          } else {
            message.error('删除失败');
          }
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败，请重试');
        }
      },
      title: '确认删除',
    });
  }

  // 初始化
  onMounted(() => {
    // 获取角色权限等级
    fetchRolePrivilegeLevels();
    // 获取园区列表
    fetchParkList();
    // 获取报销列表
    fetchReimbursementList();
  });

  // 导出组合API
  return {
    auditForm,
    auditLoading,
    auditModalVisible,
    AUDITOR_LEVEL_MAP,
    auditRemark,
    auditStatus,
    availableStatusOptions,
    checkAuditPermission,
    currentRecord,
    fetchParkList,
    fetchReimbursementList,
    fetchReimbursements,
    filterForm,
    getUserPrivilegeInfo,
    handleAuditSubmit,
    handleDelete,
    handleSearch,
    handleTableChange,
    hasAuditPermission,
    isAuditModalVisible,
    loading,
    openAuditModal,
    pagination,
    parkList,
    PRIVILEGE_LEVELS,
    reimbursementList, // 直接导出reimbursementList
    resetFilters,
    resetSearch,
    searchForm,
    showAuditModal,
    submitAudit,
    submitting,
    userPrivilegeLevel,
  };
}
