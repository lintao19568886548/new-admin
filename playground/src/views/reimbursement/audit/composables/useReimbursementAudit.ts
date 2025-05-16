import type {
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'ant-design-vue/es/table/interface';

import type { Park } from '#/components/AreaSelector.vue';

import { onMounted, reactive, ref } from 'vue';

import { message, Modal } from 'ant-design-vue';

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
  1: { color: 'success', text: '已通过' },
  2: { color: 'error', text: '已拒绝' },
};

// 状态选项
export const statusOptions = [
  { label: '待审核', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
];

export function useReimbursementAudit() {
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
    currentRecord.value = record;
    auditStatus.value = record.status;
    auditRemark.value = record.remark || '';
    auditModalVisible.value = true;
  }

  // 提交审核
  async function submitAudit() {
    if (!currentRecord.value) return;

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
      message.error('审核操作失败');
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
    fetchReimbursementList();
    fetchParkList();
  });

  return {
    auditLoading,
    auditModalVisible,
    auditRemark,
    auditStatus,
    currentRecord,
    fetchParkList,
    fetchReimbursementList,
    filterForm,
    handleDelete,
    handleSearch,
    handleTableChange,
    loading,
    openAuditModal,
    pagination,
    parkList,
    resetFilters,
    submitAudit,
    tableData,
    // STATUS_MAP and statusOptions are exported directly, no need to return from hook if used globally
  };
}
