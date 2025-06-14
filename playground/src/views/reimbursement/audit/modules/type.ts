import type {
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'ant-design-vue/es/table/interface';
import type { Dayjs } from 'dayjs'; // 导入 Dayjs 类型

import type { ReimbursementItem } from '../data';

import { computed, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { message, Modal } from 'ant-design-vue';

import {
  deleteReimbursement as apiDeleteReimbursement,
  getReimbursementList as apiGetReimbursementList,
  updateReimbursement as apiUpdateReimbursement,
} from '#/api/reimbursement';

import { STATUS_MAP } from '../data';

/**
 * 状态选项
 */
export const statusOptions = Object.entries(STATUS_MAP).map(
  ([value, info]) => ({
    label: info.text,
    value: Number.parseInt(value),
  }),
);

/**
 * 获取用户可读的权限等级信息
 * @param hasPermission 是否有权限
 * @param rates 最大审核金额 (来自 userInfo.rates)
 */
export function getUserPrivilegeInfo(
  hasPermission: boolean,
  rates?: null | number,
) {
  const text = hasPermission ? '审核员' : '无审核权限';
  let maxAmount = '无';

  if (hasPermission) {
    // 有审核权限
    // rates 为 null, undefined 或 负数时，视为无限制
    maxAmount =
      rates === null || rates === undefined || rates < 0
        ? '无限制'
        : `${rates.toLocaleString()}元以内`;
  }

  return { maxAmount, text };
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
 * 报销审核逻辑钩子
 * 提供报销审核相关的状态和方法
 */
export function useReimbursementAudit() {
  // 获取用户信息和权限
  const userStore = useUserStore();

  const hasAuditPermission = computed(
    () => (userStore.userInfo?.reimbursementAuth || 0) > 0,
  );
  const submitting = ref(false);

  /**
   * 检查指定金额是否超出当前用户的审核权限
   * @param amount 要检查的金额
   * @returns boolean - true表示超出权限
   */
  const isAmountOverLimit = (amount: number): boolean => {
    if (!hasAuditPermission.value) {
      return true;
    }
    const rates = userStore.userInfo?.rates;
    // 对于有审核权限的角色:
    // rates 为 null, undefined 或负数时，视为无限制
    if (rates === null || rates === undefined || rates < 0) {
      return false;
    }
    // 否则，比较金额和rates
    return amount > rates;
  };

  // 获取可用的审核状态选项
  const availableStatusOptions = computed(() => {
    // 移除等级制度后，所有审核员都能通过或拒绝
    if (hasAuditPermission.value) {
      return statusOptions.filter((option) => [1, 2].includes(option.value));
    }
    return [];
  });

  // 表格数据
  const reimbursementList = ref<ReimbursementItem[]>([]);
  const loading = ref(false);
  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 搜索表单 - 此处在list.vue中使用
  const searchForm = reactive<{
    dateRange: [Dayjs, Dayjs] | undefined;
    park: string;
    payee: string;
    purpose: string;
    status: number | undefined;
  }>({
    dateRange: undefined,
    park: '',
    payee: '',
    purpose: '',
    status: undefined,
  });

  // 重置搜索
  function resetSearch() {
    searchForm.dateRange = undefined;
    searchForm.purpose = '';
    searchForm.status = undefined;
    searchForm.payee = '';
    searchForm.park = undefined;
    pagination.current = 1;
    fetchReimbursements();
  }

  // 审核表单 - 此处在list.vue中使用
  const auditForm = reactive({
    reason: '',
    status: undefined,
  });

  // 审核对话框
  const isAuditModalVisible = ref(false); // list.vue中使用
  const currentRecord = ref<null | ReimbursementItem>(null);

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
        params.startDate = searchForm.dateRange[0]?.format('YYYY-MM-DD');
        params.endDate = searchForm.dateRange[1]?.format('YYYY-MM-DD');
      }

      // 任何人都可以按领款人筛选
      if (searchForm.payee) {
        params.payee = searchForm.payee;
      }

      // 添加园区搜索条件
      if (searchForm.park) {
        // 将园区名称转换为园区ID
        const parkId = Number(searchForm.park);
        if (!Number.isNaN(parkId)) {
          params.parkId = parkId;
        }
      }

      // 非审核人员只能在自己的申请中进行搜索
      if (!hasAuditPermission.value) {
        params.username = userStore.userInfo?.username;
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

      // 使用新的权限检查函数
      if (isAmountOverLimit(value)) {
        message.error('金额超出您的审核权限，无法提交。');
        submitting.value = false;
        return;
      }

      const auditResult = {
        // 其他必要信息
        amount: value,
        auditOpinion: auditForm.reason, // 将审核意见映射到 auditOpinion 字段
        // 添加审核人信息
        auditor: userStore.userInfo?.username,
        auditorId: userStore.userInfo?.userId,
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

  // 删除报销记录
  async function handleDelete(record: ReimbursementItem) {
    Modal.confirm({
      cancelText: '取消',
      content: `确定要删除"${record.purpose}"这条报销记录吗？此操作不可恢复。`,
      okText: '确认',
      onOk: async () => {
        try {
          await apiDeleteReimbursement(Number(record.id));
          message.success('记录删除成功');
          await fetchReimbursements(); // 重新加载数据
        } catch (error) {
          console.error('删除报销记录失败:', error);
          message.error('删除失败，请稍后重试');
        }
      },
      title: '确认删除',
    });
  }

  // 返回所有方法和状态
  return {
    auditForm,
    availableStatusOptions,
    currentRecord,
    fetchReimbursements,
    getUserPrivilegeInfo,
    handleAuditSubmit,
    handleDelete,
    handleSearch,
    handleTableChange,
    hasAuditPermission,
    isAmountOverLimit,
    isAuditModalVisible,
    loading,
    pagination,
    reimbursementList,
    resetSearch,
    searchForm,
    showAuditModal,
    submitting,
  };
}
