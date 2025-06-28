<script lang="ts" setup>
import type { LeaveApplication } from '#/api/hrm/leaveapplication';

import { onMounted, reactive, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Descriptions,
  List,
  message,
  Modal,
  Tag,
} from 'ant-design-vue';

import {
  deleteLeaveApplication,
  getLeaveApplicationList,
  updateLeaveApplication,
} from '#/api/hrm/leaveapplication';

import AuditModal from './modules/audit-modal.vue';
import Form from './modules/form.vue';

// ================================= 响应式状态 =================================
const list = ref<LeaveApplication[]>([]);
const loading = ref(false);
const finished = ref(false); // 是否已加载所有数据
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
});

const userStore = useUserStore();
const codes = userStore.userInfo?.codes || [];

// ================================= 模态框设置 =================================
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [AuditModalCom, auditModalApi] = useVbenModal({
  connectedComponent: AuditModal,
});

// ================================= 消息处理器 =================================
const messageHandler = {
  error: (error: any, customMessage?: string) => {
    const errorMsg = error?.message || '未知错误';
    message.error({
      content: customMessage ? `${customMessage}: ${errorMsg}` : errorMsg,
    });
    console.error(customMessage || '操作失败', error);
  },
  loading: (content: string) => {
    return message.loading({ content, duration: 0 });
  },
  success: (content: string) => {
    message.success({ content });
  },
};

// ================================= 核心业务逻辑 =================================

/**
 * 加载列表数据
 */
async function loadData() {
  if (loading.value || finished.value) {
    return;
  }
  loading.value = true;
  try {
    const result = await getLeaveApplicationList({
      currentPage: pagination.currentPage,
      pageSize: pagination.pageSize,
    });

    if (result.items.length > 0) {
      list.value.push(...result.items);
      pagination.currentPage++;
      // 如果返回的项目数少于页面大小，说明数据已全部加载完毕
      if (result.items.length < pagination.pageSize) {
        finished.value = true;
      }
    } else {
      finished.value = true; // 没有数据了
    }
  } catch (error) {
    messageHandler.error(error, '获取列表失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 刷新列表
 */
function handleRefresh() {
  // 重置状态
  list.value = [];
  pagination.currentPage = 1;
  finished.value = false;
  // 重新加载
  loadData();
}

/**
 * 处理审批操作 (批准/驳回)
 * @param row 记录
 * @param status 1: 批准, 2: 驳回
 */
async function handleAudit(row: LeaveApplication, status: 1 | 2) {
  const actionText = status === 1 ? '批准' : '驳回';
  Modal.confirm({
    content: `确定要${actionText} ${row.user} 的请假申请吗？`,
    onOk: async () => {
      const hideLoading = messageHandler.loading(`正在${actionText}申请`);
      try {
        await updateLeaveApplication(row.id, {
          auditUser: userStore.userInfo?.realName,
          status,
        });
        messageHandler.success(`成功${actionText}申请`);
        handleRefresh();
      } catch (error) {
        messageHandler.error(error, `${actionText}申请失败`);
      } finally {
        hideLoading();
      }
    },
    title: `确认${actionText}`,
  });
}

/**
 * 处理删除操作
 * @param row 记录
 */
function handleDelete(row: LeaveApplication) {
  Modal.confirm({
    content: `确定要删除 ${row.user} 的请假申请吗？`,
    onOk: () => {
      const hideLoading = messageHandler.loading(`正在删除申请`);
      deleteLeaveApplication(row.id)
        .then(() => {
          messageHandler.success(`成功删除申请`);
          handleRefresh();
        })
        .catch((error) => {
          messageHandler.error(error, '删除申请失败');
        })
        .finally(() => {
          hideLoading();
        });
    },
    title: '确认删除',
  });
}

/**
 * 处理修改操作
 * @param row 记录
 */
function handleEdit(row: LeaveApplication) {
  formModalApi.setData(row).open();
}

/**
 * 处理新建操作
 */
function handleCreate() {
  formModalApi.setData(null).open();
}

// ================================= 辅助函数 =================================
/**
 * 获取状态对应的颜色和文本
 * @param status 状态码
 */
function getStatusInfo(status: number) {
  const statusMap: Record<number, { color: string; text: string }> = {
    0: { color: 'warning', text: '待审核' },
    1: { color: 'success', text: '已通过' },
    2: { color: 'error', text: '未通过' },
  };
  return statusMap[status] || { color: 'default', text: `未知状态(${status})` };
}

/**
 * 格式化日期时间
 */
function formatDateTime(value: string) {
  return value ? value.replace('T', ' ').split('.')[0] : 'N/A';
}

// ================================= 生命周期 =================================
onMounted(() => {
  loadData();
});
</script>

<template>
  <Page class="mobile-leave-page" content-class="p-3">
    <!-- 模态框 -->
    <FormModal @success="handleRefresh" />
    <AuditModalCom @success="handleRefresh" />

    <!-- 列表 -->
    <List
      :loading="loading"
      :data-source="list"
      :grid="{ gutter: 16, xs: 1, sm: 1, md: 1, lg: 1, xl: 1, xxl: 1 }"
      item-layout="vertical"
    >
      <template #renderItem="{ item }">
        <List.Item>
          <Card class="leave-card" :bordered="false">
            <template #title>
              <div class="card-title">
                <span>{{ item.user }}</span>
                <Tag :color="getStatusInfo(item.status).color">
                  {{ getStatusInfo(item.status).text }}
                </Tag>
              </div>
            </template>
            <template #extra>
              <Button
                v-if="codes.includes('LEAVE_AUDIT')"
                type="link"
                @click="auditModalApi.setData(item).open()"
              >
                审批
              </Button>
            </template>
            <Descriptions :column="1" size="small">
              <Descriptions.Item label="所在园区">
                {{ item.park }}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {{ formatDateTime(item.startDate) }}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {{ formatDateTime(item.endDate) }}
              </Descriptions.Item>
              <Descriptions.Item label="请假原因">
                {{ item.reason }}
              </Descriptions.Item>
              <Descriptions.Item v-if="item.auditUser" label="审核人">
                {{ item.auditUser }}
              </Descriptions.Item>
              <Descriptions.Item v-if="item.reply" label="审批意见">
                {{ item.reply }}
              </Descriptions.Item>
              <Descriptions.Item label="最后操作人">
                {{ item.username }}
              </Descriptions.Item>
            </Descriptions>

            <!-- 卡片底部的操作按钮 -->
            <template #actions>
              <Button
                v-if="item.status === 0 && codes.includes('LEAVE_AUDIT')"
                type="link"
                @click="handleAudit(item, 1)"
              >
                批准
              </Button>
              <Button
                v-if="item.status === 0 && codes.includes('LEAVE_AUDIT')"
                type="link"
                danger
                @click="handleAudit(item, 2)"
              >
                驳回
              </Button>
              <Button
                v-if="item.status === 0"
                type="link"
                @click="handleEdit(item)"
              >
                修改
              </Button>
              <Button
                v-if="item.status !== 1"
                type="link"
                danger
                @click="handleDelete(item)"
              >
                删除
              </Button>
            </template>
          </Card>
        </List.Item>
      </template>

      <template #loadMore>
        <div v-if="!loading && !finished" class="load-more">
          <Button block @click="loadData">加载更多</Button>
        </div>
        <div v-if="finished" class="load-finished">
          <span>没有更多了</span>
        </div>
      </template>
    </List>

    <!-- 悬浮新建按钮 -->
    <div class="fab-container">
      <Button
        type="primary"
        shape="circle"
        size="large"
        class="fab"
        @click="handleCreate"
      >
        <Plus class="size-6" />
      </Button>
    </div>
  </Page>
</template>

<style scoped>
.mobile-leave-page {
  background-color: #f0f2f5;
}

.leave-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 9%);
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:deep(.ant-descriptions-item-label) {
  width: 80px;
  color: #888;
}

.load-more,
.load-finished {
  padding: 16px 0;
  text-align: center;
}

.load-finished span {
  color: #aaa;
}

.fab-container {
  position: fixed;
  right: 1.5rem;
  bottom: 2rem;
  z-index: 99;
}

.fab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border: none;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}
</style>
