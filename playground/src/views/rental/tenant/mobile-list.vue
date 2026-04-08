<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import { computed, h, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

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
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Spin,
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
  getPartyAContactName,
  getPartyAContactPhone,
  getPartyADisplayName,
  getPartyBContactName,
  getPartyBContactPhone,
  getPartyBDisplayName,
  getTagTypeOptions,
} from './data';
import TenantForm from './modules/form.vue';

const currentPark = ref();
const loading = ref(false);
const searchForm = ref({
  partyAName: '',
  partyBContactPhone: '',
  partyBName: '',
  status: undefined,
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

function formatSendMessageDisplay(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未发送';
}

function getIncreaseSummary(row: RentalManagementItem) {
  const rate = calculateIncreaseRateDisplay(row) || '无';
  const date = calculateIncreaseDateDisplay(row) || '无';
  if (rate === '无' && date === '无') {
    return '无';
  }
  return `${rate} / ${date}`;
}

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
  const displayName = getPartyBDisplayName(row);
  message.loading({
    content: $t('ui.actionMessage.deleting', [displayName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteTenant(row.rentalTenantId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [displayName || '']),
      key: 'action_process_msg',
    });
    fetchList();
  } catch (error) {
    console.error('删除租户失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [displayName || '']),
      key: 'action_process_msg',
    });
  }
}

async function onSendSms(row: RentalManagementItem) {
  try {
    const displayName = getPartyBDisplayName(row);
    Modal.confirm({
      content: `您确定要向乙方 [${displayName}] 发送短信吗？`,
      onCancel() {
        message.info('已取消发送短信');
      },
      onOk: async () => {
        message.loading({
          content: '正在获取租户信息...',
          duration: 0,
          key: 'sms_process_msg',
        });

        const smsInfo = await getTenantSmsInfo(row.rentalTenantId);

        message.loading({
          content: '正在发送短信...',
          duration: 0,
          key: 'sms_process_msg',
        });

        await sendSms({
          contractEndDate: smsInfo.contractEndDate,
          increaseDate: smsInfo.increaseDate,
          phoneNumber: smsInfo.partyBContactPhone || smsInfo.phoneNumber,
          rentalTenantId: row.rentalTenantId,
          tenantName: smsInfo.partyBName || smsInfo.tenantName,
        });

        message.success({
          content: `短信已成功发送给 ${displayName}`,
          key: 'sms_process_msg',
        });

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
    partyAName: '',
    partyBContactPhone: '',
    partyBName: '',
    status: undefined,
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

async function onBulkSendSms() {
  try {
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
          const result = await sendBulkSms();

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
  <Page class="bg-gray-100 p-2 dark:bg-neutral-900">
    <FormModal @success="refreshList" />

    <div
      class="search-filters mb-2 rounded bg-white p-3 shadow-sm dark:bg-neutral-800"
    >
      <Form :model="searchForm" layout="vertical">
        <Row :gutter="16">
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
          <Col :span="12">
            <Form.Item :label="$t('system.rental.tenant.partyAName')">
              <Input
                v-model:value="searchForm.partyAName"
                allow-clear
                placeholder="请输入甲方名称"
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item :label="$t('system.rental.tenant.partyBName')">
              <Input
                v-model:value="searchForm.partyBName"
                allow-clear
                placeholder="请输入乙方名称"
              />
            </Form.Item>
          </Col>
          <Col :span="24">
            <Form.Item :label="$t('system.rental.tenant.partyBContactPhone')">
              <Input
                v-model:value="searchForm.partyBContactPhone"
                allow-clear
                placeholder="请输入乙方联系电话"
              />
            </Form.Item>
          </Col>
          <Col :span="24">
            <Form.Item label="合同状态">
              <Select
                v-model:value="searchForm.status"
                :options="tagTypeOptions"
                allow-clear
                placeholder="请选择合同状态"
              />
            </Form.Item>
          </Col>
        </Row>
        <div class="mt-2 flex gap-2">
          <Button type="primary" @click="handleSearch" class="flex-1">
            {{ $t('common.search') }}
          </Button>
          <Button @click="resetSearch" class="flex-1">
            {{ $t('common.reset') }}
          </Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('ui.loading')">
      <div v-if="tenantList.length > 0" class="mobile-content">
        <Card
          v-for="item in tenantList"
          :key="item.rentalTenantId"
          class="mb-3 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-neutral-800"
          :body-style="{ padding: '0' }"
        >
          <div class="p-4">
            <div class="mb-3 grid grid-cols-2 gap-4">
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  甲方名称
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getPartyADisplayName(item) || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  乙方名称
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getPartyBDisplayName(item) || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  甲方联系人
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getPartyAContactName(item) || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  乙方联系人
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getPartyBContactName(item) || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  甲方电话
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getPartyAContactPhone(item) || '-' }}
                </span>
              </div>

              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  乙方电话
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getPartyBContactPhone(item) || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  租金
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ formatRentDisplay(item.rent ?? '') || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  面积
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ formatAreaDisplay(item.area ?? '') || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  合同日期
                </span>
                <span
                  class="relative top-[5px] whitespace-nowrap text-[12px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ formatContractDateDisplay(item) || '-' }}
                </span>
              </div>
              <div class="flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  合同状态
                </span>
                <div class="pt-1">
                  <component :is="getStatusTag(item)" />
                </div>
              </div>
              <div class="col-span-2 flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  租赁地点
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ item.address || '-' }}
                </span>
              </div>
              <div class="col-span-2 flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  下次递增
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ getIncreaseSummary(item) }}
                </span>
              </div>
              <div class="col-span-2 flex flex-col text-left">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  上次发送短信
                </span>
                <span
                  class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                >
                  {{ formatSendMessageDisplay(item.sendMessage) }}
                </span>
              </div>
            </div>

            <p
              v-if="item.remark"
              class="mt-3 rounded-md bg-gray-50 px-3 py-2 text-[14px] leading-relaxed text-gray-600 dark:bg-neutral-700 dark:text-gray-200"
            >
              <span class="mr-1 font-semibold">备注:</span>
              <span class="whitespace-pre-wrap break-all">{{
                item.remark
              }}</span>
            </p>
          </div>

          <div
            class="flex justify-center gap-3 border-t border-gray-100 px-4 py-3 dark:border-neutral-700"
          >
            <Button type="default" @click="onEdit(item)">
              <template #icon><EditOutlined /></template>
              {{ $t('ui.action.edit') }}
            </Button>
            <Button type="primary" @click="onSendSms(item)">
              <template #icon><MessageOutlined /></template>
              发短信
            </Button>
            <Popconfirm
              :title="
                $t('ui.actionMessage.deleteConfirm', [
                  getPartyBDisplayName(item),
                ])
              "
              @confirm="onDelete(item)"
              placement="top"
              :overlay-style="{ maxWidth: '250px' }"
            >
              <Button danger :aria-label="$t('ui.action.delete')">
                <template #icon><DeleteOutlined /></template>
                {{ $t('ui.action.delete') }}
              </Button>
            </Popconfirm>
          </div>
        </Card>

        <div class="pb-2">
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
        </div>
      </div>

      <Empty
        v-if="!loading && tenantList.length === 0"
        class="py-10"
        description="暂无合同数据"
      />
    </Spin>

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

<style lang="less" scoped>
.search-filters :deep(.ant-form-item) {
  margin-bottom: 8px;
}

.mobile-content {
  padding-bottom: 8px;
}

:deep(.ant-tag) {
  margin-inline-end: 0;
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
