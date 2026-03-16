<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import { computed, h, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';

import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  deleteTenant,
  getTenantList,
  getTenantSmsInfo,
  sendBulkSms,
  sendSms,
} from '#/api/rental';
import { $t } from '#/locales';
import { useLayoutStore } from '#/store/layout';
import { useParkStore } from '#/store/park';

import {
  calculateIncreaseDateDisplay,
  calculateIncreaseRateDisplay,
  formatAreaDisplay,
  formatContractDateDisplay,
  formatRentDisplay,
  getTagTypeOptions,
} from './data';
import TenantForm from './modules/form.vue';

const currentPark = ref();
const loading = ref(false);
const searchForm = ref({
  phoneNumber: '',
  status: undefined,
  tenantName: '',
});
const tenantList = ref<RentalManagementItem[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});

const layoutStore = useLayoutStore();
const parkStore = useParkStore();

const isLastPage = computed(
  () => tenantList.value.length >= pagination.value.total,
);

const tagTypeOptions = getTagTypeOptions();

const getStatusTag = (row: RentalManagementItem) => {
  const isExpired = row.contractEnd
    ? dayjs().isAfter(dayjs(row.contractEnd))
    : false;
  const statusText = isExpired ? '过期' : '生效中';
  const option = tagTypeOptions.find((opt) => opt.label === statusText);
  return h(Tag, { color: option?.color || 'default' }, () => statusText);
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: TenantForm,
  destroyOnClose: true,
});

function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

async function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteTenant(row.rentalTenantId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
      key: 'action_process_msg',
    });
    // Refresh the list after deletion
    fetchList();
  } catch (error) {
    console.error('删除租户失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.tenantName || '']),
      key: 'action_process_msg',
    });
  }
}

/**
 * 发送短信
 */
async function onSendSms(row: RentalManagementItem) {
  try {
    // 添加确认对话框
    Modal.confirm({
      content: `您确定要向租户 [${row.tenantName}] 发送短信吗？`,
      onCancel() {
        message.info('已取消发送短信');
      },
      onOk: async () => {
        message.loading({
          content: '正在获取租户信息...',
          duration: 0,
          key: 'sms_process_msg',
        });

        // 获取租户短信信息
        const smsInfo = await getTenantSmsInfo(row.rentalTenantId);

        message.loading({
          content: '正在发送短信...',
          duration: 0,
          key: 'sms_process_msg',
        });

        // 发送短信
        await sendSms({
          contractEndDate: smsInfo.contractEndDate,
          increaseDate: smsInfo.increaseDate,
          phoneNumber: smsInfo.phoneNumber,
          rentalTenantId: row.rentalTenantId,
          tenantName: smsInfo.tenantName,
        });

        message.success({
          content: `短信已成功发送给 ${row.tenantName}`,
          key: 'sms_process_msg',
        });

        // 刷新列表数据以显示最新的发送时间
        refreshList();
      },
      title: '发送短信确认',
    });
  } catch (error) {
    console.error('发送短信失败:', error);
    message.error({
      content: `发送短信失败: ${(error as Error).message || '未知错误'}`,
      key: 'sms_process_msg',
    });
  }
}

async function fetchList(isLoadMore = false) {
  loading.value = true;
  if (!isLoadMore) {
    pagination.value.currentPage = 1;
  }
  const params = {
    ...searchForm.value,
    currentPage: pagination.value.currentPage,
    currentPark: currentPark.value ?? -1,
    pageSize: pagination.value.pageSize,
  };
  try {
    const result = await getTenantList(params);
    const newItems = result.items || [];
    if (isLoadMore) {
      tenantList.value.push(...newItems);
    } else {
      tenantList.value = newItems;
    }
    pagination.value.total = result.total || 0;
  } catch (error) {
    console.error('获取租户列表失败:', error);
    message.error('获取租户列表失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  fetchList();
}

function resetSearch() {
  searchForm.value = {
    phoneNumber: '',
    status: undefined,
    tenantName: '',
  };
  currentPark.value = undefined;
  fetchList();
}

function handleLoadMore() {
  if (isLastPage.value) return;
  pagination.value.currentPage++;
  fetchList(true);
}

function refreshList() {
  fetchList();
}

/**
 * 批量发送短信
 */
async function onBulkSendSms() {
  try {
    // 添加确认对话框
    Modal.confirm({
      content: `
        系统将自动筛选符合以下条件的租户发送催缴短信：
        • 合同状态为生效中
        • 合同截止日期少于90天
        • 或下次递增时间少于30天
        
        您确定要继续吗？
      `,
      onCancel() {
        message.info('已取消发送');
      },
      onOk: async () => {
        message.loading({
          content: '正在筛选符合条件的租户并发送短信...',
          duration: 0,
          key: 'bulk_sms_process_msg',
        });

        try {
          // 调用批量发送短信的API
          const result = await sendBulkSms();

          // 显示详细的发送结果
          if (result.data) {
            const { failed, success, total } = result.data;

            if (total === 0) {
              message.info({
                content: '没有符合条件的租户需要发送短信',
                key: 'bulk_sms_process_msg',
              });
            } else {
              message.success({
                content: `批量发送完成！共筛选 ${total} 个租户，成功发送 ${success} 条，失败 ${failed} 条`,
                duration: 6,
                key: 'bulk_sms_process_msg',
              });

              // 如果有失败的，显示详细信息
              if (failed > 0 && result.data.errors) {
                console.warn('发送失败的租户:', result.data.errors);
                Modal.warning({
                  content: `有 ${failed} 条短信发送失败，请查看控制台了解详情`,
                  title: '部分短信发送失败',
                });
              }
            }
          } else {
            message.success({
              content: '催缴短信已批量发送成功',
              key: 'bulk_sms_process_msg',
            });
          }

          // 刷新列表数据以显示可能更新的状态
          refreshList();
        } catch (apiError) {
          console.error('批量发送短信API调用失败:', apiError);
          message.error({
            content: `批量发送短信失败: ${(apiError as Error).message || '未知错误'}`,
            key: 'bulk_sms_process_msg',
          });
        }
      },
      title: '批量发送催缴短信确认',
    });
  } catch (error) {
    console.error('批量发送短信失败:', error);
    message.error({
      content: `批量发送短信失败: ${(error as Error).message || '未知错误'}`,
      key: 'bulk_sms_process_msg',
    });
  }
}

onMounted(() => {
  parkStore.fetchParkList();
  fetchList();
  layoutStore.setHeaderActions([
    {
      key: 'bulk-sms',
      onClick: onBulkSendSms,
      text: '批量短信',
    },
  ]);
});

onUnmounted(() => {
  layoutStore.clearHeaderActions();
});
</script>

<template>
  <Page class="mobile-tenant-list-page">
    <FormModal @success="refreshList" />

    <details class="search-details">
      <summary class="search-summary">
        筛选条件 <Search class="inline-icon" />
      </summary>
      <div class="search-form-container">
        <Form :model="searchForm" layout="vertical">
          <Row :gutter="16">
            <Col :span="12">
              <Form.Item label="租户名称">
                <Input
                  v-model:value="searchForm.tenantName"
                  allow-clear
                  placeholder="请输入"
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="联系电话">
                <Input
                  v-model:value="searchForm.phoneNumber"
                  allow-clear
                  placeholder="请输入"
                />
              </Form.Item>
            </Col>
            <Col :span="24">
              <Form.Item label="园区">
                <Select
                  v-model:value="currentPark"
                  :options="parkStore.parkList"
                  :field-names="{ label: 'parkName', value: 'parkId' }"
                  allow-clear
                  placeholder="请选择园区"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="合同状态">
            <Select
              v-model:value="searchForm.status"
              :options="tagTypeOptions"
              allow-clear
              placeholder="请选择"
            />
          </Form.Item>
          <div class="search-actions">
            <Button @click="resetSearch" type="default" class="flex-1">
              重置
            </Button>
            <Button @click="handleSearch" type="primary" class="flex-1">
              <template #icon><Search /></template>
              查询
            </Button>
          </div>
        </Form>
      </div>
    </details>

    <div class="mobile-content">
      <Empty
        v-if="!loading && tenantList.length === 0"
        description="暂无租户数据"
        class="py-10"
      />
      <List
        v-else
        :data-source="tenantList"
        :loading="loading && pagination.currentPage === 1"
        :split="false"
        item-layout="vertical"
        row-key="rentalTenantId"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <Card :bordered="false" class="tenant-card">
              <template #title>
                <div class="card-header">
                  <span class="tenant-name">{{ item.tenantName }}</span>
                  <component :is="getStatusTag(item)" />
                </div>
              </template>

              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">电话:</span>
                  <span>{{ item.phoneNumber || '暂无' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">租金:</span>
                  <span>{{ formatRentDisplay(item.rent) || '暂无' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">面积:</span>
                  <span>{{ formatAreaDisplay(item.area) || '暂无' }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">地址:</span>
                  <span>{{ item.address || '暂无地址' }}</span>
                </div>

                <div class="info-item full-width">
                  <span class="info-label">合同日期:</span>
                  <span>{{
                    formatContractDateDisplay(item) || '暂无合同日期'
                  }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">下次递增:</span>
                  <span>{{
                    `${calculateIncreaseRateDisplay(item) || '无'} (${
                      calculateIncreaseDateDisplay(item) || '无'
                    })`
                  }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">上次发送短信:</span>
                  <span>{{
                    item.sendMessage
                      ? dayjs(item.sendMessage).format('YYYY-MM-DD HH:mm')
                      : '未发送'
                  }}</span>
                </div>
              </div>

              <template #actions>
                <Button type="text" @click="onEdit(item)">
                  <template #icon><EditOutlined /></template>
                  {{ $t('ui.action.edit') }}
                </Button>
                <Button type="text" @click="onSendSms(item)">
                  <template #icon><MessageOutlined /></template>
                  发短信
                </Button>
                <Popconfirm
                  :title="
                    $t('ui.actionMessage.deleteConfirm', [item.tenantName])
                  "
                  @confirm="onDelete(item)"
                  placement="top"
                  :overlay-style="{ maxWidth: '250px' }"
                >
                  <Button
                    type="text"
                    status="danger"
                    :aria-label="$t('ui.action.delete')"
                  >
                    <template #icon><DeleteOutlined /></template>
                    {{ $t('ui.action.delete') }}
                  </Button>
                </Popconfirm>
              </template>
            </Card>
          </List.Item>
        </template>
        <template #loadMore>
          <div v-if="!isLastPage" class="load-more-container">
            <Button @click="handleLoadMore" :loading="loading" block>
              加载更多
            </Button>
          </div>
          <div
            v-else-if="tenantList.length > 0"
            class="load-more-container no-more"
          >
            没有更多了
          </div>
        </template>
      </List>
    </div>
    <Teleport to="body">
      <div
        class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom)+3.25rem)] right-4 z-[1000] flex flex-col gap-3"
      >
        <Button
          type="primary"
          shape="circle"
          size="large"
          @click="onCreate"
          class="!inline-flex !h-14 !w-14 items-center justify-center !p-0 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
        >
          <PlusOutlined class="text-xl" />
        </Button>
      </div>
    </Teleport>
  </Page>
</template>

<style scoped>
.mobile-tenant-list-page {
  padding: 8px;
  background-color: #f5f5f5;
}

.mobile-header {
  padding: 12px 16px;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.mobile-content {
  padding: 0;
}

:deep(.ant-list-item) {
  padding: 8px 0 !important;
  border: none !important;
}

.tenant-card {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 9%);
}

:deep(.ant-card-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: auto;
  padding: 10px 16px;
  font-size: 16px;
}

:deep(.ant-card-head-title) {
  flex: 1 1 auto;
  padding: 0;
}

:deep(.ant-card-extra) {
  flex: 0 0 auto;
  padding: 0;
  margin-left: 8px;
}

:deep(.ant-card-body) {
  padding: 12px 16px;
}

:deep(.ant-card-actions) {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 16px;
  font-size: 15px;
  background-color: #fff;
}

:deep(.ant-card-actions > li) {
  flex: 0 1 auto;
  justify-content: space-between;
  margin: 0 !important;
  text-align: center;
  border-right: none !important;
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.tenant-name {
  font-size: 17px;
  font-weight: 500;
  word-break: break-all;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 15px;
  color: #555;
}

.info-item {
  display: flex;
  align-items: start;
  overflow: hidden;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  flex-shrink: 0;
  padding-right: 8px;
  color: #888;
  text-align: left;
}

.info-item > span:last-of-type {
  word-break: break-word;
}

.search-details {
  padding: 0;
  margin-bottom: 12px;
  background-color: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 17px;
  cursor: pointer;
}

.search-summary .inline-icon {
  width: 1em;
  height: 1em;
}

.search-form-container {
  padding: 12px;
  border-top: 1px solid #e8e8e8;
}

.search-form-container .ant-form-item {
  margin-bottom: 12px;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.flex-1 {
  flex: 1;
}

.load-more-container {
  padding: 16px 0;
}

.load-more-container.no-more {
  font-size: 14px;
  color: #999;
  text-align: center;
}
</style>
