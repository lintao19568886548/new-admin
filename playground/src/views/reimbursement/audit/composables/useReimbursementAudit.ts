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
import { $t } from '#/locales'; // Assuming $t is globally available or imported appropriately

// 定义类型
export interface ReimbursementItem {
  amount: number;
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

// 状态映射
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
  GENERAL_MANAGER: 3, // 总经理 - 二级审核
  NO_AUDIT: 0, // 无审核权限
  PARK_MANAGER: 2, // 园区经理 - 一级审核
};

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

      // 从返回的数据结构中正确获取角色列表
      // 处理返回的角色数据，确保获取正确的角色列表
      const roleList = Array.isArray(roles)
        ? roles
        : (roles as any)?.items || [];

      if (Array.isArray(roleList)) {
        roleList.forEach((role) => {
          if (role.name && role.level !== undefined) {
            levelMap[role.name] = role.level;
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
    } else if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.GENERAL_MANAGER) {
      // 总经理可以提交到三级审核或拒绝
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

  // 审核对话框
  const auditModalVisible = ref(false);
  const currentRecord = ref<null | ReimbursementItem>(null);
  const auditStatus = ref<number>(0);
  const auditRemark = ref('');
  const auditLoading = ref(false);

  // 获取报销列表数据
  async function fetchReimbursementList() {
    loading.value = true;
    try {
      const params: Record<string, any> = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
      };

      if (filterForm.purpose) {
        params.purpose = filterForm.purpose;
      }
      if (filterForm.department) {
        params.department = filterForm.department;
      }
      if (filterForm.status !== undefined) {
        params.status = filterForm.status;
      }
      if (filterForm.dateRange && filterForm.dateRange.length === 2) {
        params.startDate = filterForm.dateRange[0]?.format('YYYY-MM-DD');
        params.endDate = filterForm.dateRange[1]?.format('YYYY-MM-DD');
      }
      if (filterForm.parkId) {
        params.parkId = filterForm.parkId;
      }

      const response = await apiGetReimbursementList(params);
      tableData.value = response.items || [];
      pagination.total = response.total || 0;
    } catch (error) {
      console.error('获取报销列表失败:', error);
      message.error('获取报销列表失败');
    } finally {
      loading.value = false;
    }
  }

  // 表格变化处理
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

  // 搜索
  function handleSearch() {
    pagination.current = 1;
    fetchReimbursementList();
  }

  // 打开审核对话框
  function openAuditModal(record: ReimbursementItem) {
    // 检查用户是否有审核权限
    if (!hasAuditPermission.value) {
      message.warning('您没有审核权限');
      return;
    }

    const amount = Number(record.amount) || 0;

    // 检查金额是否超出用户的审核权限
    if (
      userPrivilegeLevel.value === PRIVILEGE_LEVELS.PARK_MANAGER &&
      amount > 10_000
    ) {
      message.warning(
        `您的审核权限仅限于10000元以下的报销记录，当前金额为${amount}元`,
      );
      return;
    } else if (
      userPrivilegeLevel.value === PRIVILEGE_LEVELS.GENERAL_MANAGER &&
      amount > 20_000
    ) {
      message.warning(
        `您的审核权限仅限于20000元以下的报销记录，当前金额为${amount}元`,
      );
      return;
    }

    // 检查记录状态是否符合当前用户的审核权限
    const canAudit = checkAuditPermission(record);
    if (!canAudit) {
      message.warning('您没有权限审核当前状态的报销记录');
      return;
    }

    currentRecord.value = record;
    // 设置默认审核状态
    switch (userPrivilegeLevel.value) {
      case PRIVILEGE_LEVELS.CHAIRMAN: {
        auditStatus.value = 1; // 默认设置为通过

        break;
      }
      case PRIVILEGE_LEVELS.GENERAL_MANAGER: {
        auditStatus.value = 4; // 默认设置为二级审核

        break;
      }
      case PRIVILEGE_LEVELS.PARK_MANAGER: {
        auditStatus.value = 3; // 默认设置为一级审核

        break;
      }
      default: {
        auditStatus.value = record.status;
      }
    }

    auditRemark.value = record.remark || '';
    auditModalVisible.value = true;
  }

  // 检查用户是否有权限审核特定状态的报销记录
  function checkAuditPermission(record: ReimbursementItem): boolean {
    // 如果没有审核权限，直接返回false
    if (!hasAuditPermission.value) {
      return false;
    }

    const status = record.status;
    const amount = Number(record.amount) || 0;

    // 董事长可以审核二级审核状态的记录，金额不限
    if (userPrivilegeLevel.value >= PRIVILEGE_LEVELS.CHAIRMAN) {
      return status === 4 || status === 0; // 可以审核二级审核或待审核的记录
    }

    // 总经理可以审核一级审核状态的记录，金额限制在10001-20000元
    if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.GENERAL_MANAGER) {
      // 检查金额是否在总经理的审核范围内
      if (amount > 20_000) {
        return false; // 超出总经理的审核金额范围
      }
      return status === 3 || status === 0; // 可以审核一级审核或待审核的记录
    }

    // 园区经理可以审核待审核状态的记录，金额限制在10000元以下
    if (userPrivilegeLevel.value === PRIVILEGE_LEVELS.PARK_MANAGER) {
      // 检查金额是否在园区经理的审核范围内
      if (amount > 10_000) {
        return false; // 超出园区经理的审核金额范围
      }
      return status === 0; // 只能审核待审核的记录
    }

    return false;
  }

  // 提交审核
  async function submitAudit() {
    if (!currentRecord.value) return;

    // 验证状态值是否有效
    if (![0, 1, 2, 3, 4].includes(auditStatus.value)) {
      message.error('无效的状态值，请选择有效的审核状态');
      return;
    }

    // 验证用户是否有权限设置该状态值
    const userLevel = userPrivilegeLevel.value;
    const amount = Number(currentRecord.value.amount) || 0;

    // 园区经理只能设置一级审核状态，且金额不超过10000
    if (userLevel === PRIVILEGE_LEVELS.PARK_MANAGER) {
      if (amount > 10_000) {
        message.error('您无权审核超过10000元的报销记录');
        return;
      }
      if (auditStatus.value !== 3 && auditStatus.value !== 2) {
        message.error('园区经理只能设置为"一级审核"或"已拒绝"状态');
        return;
      }
    }

    // 总经理只能设置二级审核状态或拒绝，且金额不超过20000
    if (userLevel === PRIVILEGE_LEVELS.GENERAL_MANAGER) {
      if (amount > 20_000) {
        message.error('您无权审核超过20000元的报销记录');
        return;
      }
      if (auditStatus.value !== 4 && auditStatus.value !== 2) {
        message.error('总经理只能设置为"二级审核"或"已拒绝"状态');
        return;
      }
    }

    // 董事长可以设置为通过或拒绝
    if (
      userLevel === PRIVILEGE_LEVELS.CHAIRMAN &&
      auditStatus.value !== 1 &&
      auditStatus.value !== 2
    ) {
      message.error('董事长只能设置为"已通过"或"已拒绝"状态');
      return;
    }

    auditLoading.value = true;
    try {
      await apiUpdateReimbursement(Number(currentRecord.value.id), {
        remark: auditRemark.value,
        status: auditStatus.value,
      });

      message.success('审核操作成功');
      auditModalVisible.value = false;
      fetchReimbursementList(); // Refresh list after audit
    } catch (error) {
      console.error('审核操作失败:', error);
      message.error(`审核操作失败: ${(error as Error).message || '未知错误'}`);
    } finally {
      auditLoading.value = false;
    }
  }

  // 删除报销记录
  async function handleDelete(record: ReimbursementItem) {
    Modal.confirm({
      cancelText: $t('取消'),
      content: $t('确定要删除这条报销记录吗？'),
      okText: $t('确定'),
      async onOk() {
        try {
          await apiDeleteReimbursement(Number(record.id));
          message.success('删除成功');
          fetchReimbursementList(); // Refresh list after delete
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      },
      title: $t('确认删除'),
    });
  }

  // 初始化加载数据
  onMounted(() => {
    fetchRolePrivilegeLevels();
    fetchReimbursementList();
    fetchParkList();
  });

  return {
    auditLoading,
    auditModalVisible,
    auditRemark,
    auditStatus,
    availableStatusOptions,
    checkAuditPermission,
    currentRecord,
    fetchParkList,
    fetchReimbursementList,
    fetchRolePrivilegeLevels,
    filterForm,
    handleDelete,
    handleSearch,
    handleTableChange,
    hasAuditPermission,
    loading,
    openAuditModal,
    pagination,
    parkList,
    resetFilters,
    rolePrivilegeLevels,
    submitAudit,
    tableData,
    userPrivilegeLevel,
    // STATUS_MAP and statusOptions are exported directly, no need to return from hook if used globally
  };
}
