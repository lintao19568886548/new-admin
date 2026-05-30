<script lang="ts" setup>
import type {
  VipMembershipRefundOrder,
  VipMembershipRefundResult,
} from '#/api/wechat-pay';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, Card, Empty, message, Modal, Spin, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  listVipMembershipRefundOrders,
  refundVipMembershipWechatOrder,
} from '#/api/wechat-pay';
import { useAuthStore } from '#/store';

defineOptions({ name: 'ProfileVipRefunds' });

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();

const userInfo = computed(() => userStore.userInfo as any);
const currentCustomerId = computed(() =>
  String(userInfo.value?.customerId || ''),
);
const currentUserRoles = computed(() => {
  const roles = userInfo.value?.roles;
  return Array.isArray(roles) ? roles.map(String) : [];
});
const canManageRefunds = computed(
  () =>
    currentUserRoles.value.includes('Super') &&
    Boolean(currentCustomerId.value) &&
    !['default', 'public'].includes(currentCustomerId.value),
);

const loading = ref(false);
const refundingOutTradeNo = ref('');
const orders = ref<VipMembershipRefundOrder[]>([]);

const refundableCount = computed(
  () => orders.value.filter((order) => order.refundable).length,
);
const paidCount = computed(
  () => orders.value.filter((order) => order.tradeState === 'SUCCESS').length,
);

function formatMoney(amountTotal: number) {
  return `¥${(Number(amountTotal || 0) / 100).toFixed(2)}`;
}

function formatDate(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未记录';
}

function getRefundStatusView(status?: string) {
  if (status === 'SUCCESS') {
    return { color: 'success', label: '已退款' };
  }
  if (status === 'CREATE_FAILED') {
    return { color: 'error', label: '退款提交失败，可重试' };
  }
  if (['CREATE_PENDING', 'PENDING', 'PROCESSING'].includes(String(status))) {
    return { color: 'processing', label: '退款处理中' };
  }
  if (['ABNORMAL', 'CLOSED'].includes(String(status))) {
    return { color: 'warning', label: '退款未成功' };
  }
  if (status === 'IGNORED_NO_ENTITLEMENT') {
    return { color: 'success', label: '已退款' };
  }
  if (status === 'MANUAL_REVIEW') {
    return { color: 'warning', label: '退款需人工核对' };
  }
  return { color: 'warning', label: '退款状态待确认' };
}

function getTradeStateView(order: VipMembershipRefundOrder) {
  const refundStatus = order.latestRefund?.status;
  if (refundStatus) {
    return getRefundStatusView(refundStatus);
  }
  if (order.tradeState === 'SUCCESS') {
    return { color: 'success', label: '支付成功' };
  }
  if (order.tradeState === 'REFUND') {
    return { color: 'success', label: '已退款' };
  }
  return { color: 'warning', label: order.tradeState || '未知状态' };
}

function getProvisioningStatusView(status?: string) {
  if (status === 'active') {
    return { color: 'success', label: '已开通' };
  }
  if (status === 'pending') {
    return { color: 'processing', label: '等待开通' };
  }
  if (status === 'provisioning') {
    return { color: 'processing', label: '开通中' };
  }
  if (status === 'failed_manual') {
    return { color: 'error', label: '人工处理' };
  }
  if (status === 'failed_retryable') {
    return { color: 'warning', label: '自动重试' };
  }
  if (status === 'reserved') {
    return { color: 'default', label: '草稿' };
  }
  return { color: 'default', label: status || '未关联' };
}

async function loadOrders() {
  if (!canManageRefunds.value) {
    orders.value = [];
    return;
  }

  loading.value = true;
  try {
    const result = await listVipMembershipRefundOrders();
    orders.value = result.items;
  } catch (error) {
    console.error('读取会员退款订单失败:', error);
    message.error('读取会员退款订单失败');
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  void router.push({ name: 'ProfileVipMembership' });
}

function updateOrderAfterRefund(result: VipMembershipRefundResult) {
  orders.value = orders.value.map((order) =>
    order.outTradeNo === result.outTradeNo
      ? {
          ...order,
          latestRefund: {
            outRefundNo: result.outRefundNo,
            refundAmount: result.refundAmount,
            status: result.status,
          },
          refundable: false,
          refundDisabledReason:
            result.status === 'SUCCESS'
              ? '该订单已退款成功'
              : '退款申请已提交，请稍后查看结果',
        }
      : order,
  );
}

function handleRefundOrder(order: VipMembershipRefundOrder) {
  if (!order.refundable || refundingOutTradeNo.value) {
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: `将对会员支付订单 ${order.outTradeNo} 发起微信退款。退款成功后，会撤销该订单对应的企业会员权益。`,
    okButtonProps: { danger: true },
    okText: '确认退款',
    onOk: async () => {
      refundingOutTradeNo.value = order.outTradeNo;
      try {
        const result = await refundVipMembershipWechatOrder({
          outTradeNo: order.outTradeNo,
          reason: '后台发起会员退款',
        });
        updateOrderAfterRefund(result);
        if (result.status === 'SUCCESS') {
          await authStore.fetchUserInfo();
          void loadOrders();
        }
        message.success(
          result.status === 'SUCCESS'
            ? '会员退款已成功'
            : '会员退款已提交，系统会自动对账',
        );
      } catch (error) {
        console.error('发起会员退款失败:', error);
        message.error(
          error instanceof Error ? error.message : '发起会员退款失败',
        );
      } finally {
        refundingOutTradeNo.value = '';
      }
    },
    title: '确认发起会员退款',
  });
}

watch(
  canManageRefunds,
  (canManage) => {
    if (canManage) {
      void loadOrders();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="vip-refund-page">
    <div class="vip-refund-page__shell">
      <button class="vip-refund-page__back" type="button" @click="handleBack">
        <VbenIcon icon="mdi:arrow-left" />
        返回会员服务
      </button>

      <section class="vip-refund-hero">
        <div>
          <p class="vip-refund-hero__eyebrow">Order Management</p>
          <h1>企业订单管理</h1>
          <p class="vip-refund-hero__desc">
            这里展示当前企业租户的会员支付订单。
          </p>
          <p class="vip-refund-hero__desc">
            退款资格由后端按权益流水栈判断，只能从最新且尚未开始生效的订单往旧退。
          </p>
        </div>
        <div class="vip-refund-hero__stats">
          <span>可退款订单</span>
          <strong>{{ refundableCount }}</strong>
          <small>支付成功 {{ paidCount }} 笔</small>
        </div>
      </section>

      <Card v-if="!canManageRefunds" :bordered="false">
        <Empty description="当前账号不能管理会员退款订单">
          <template #image>
            <VbenIcon icon="mdi:shield-lock-outline" class="empty-icon" />
          </template>
          <p class="vip-refund-page__empty-desc">
            只有企业租户内的 Super 角色账号可以查看订单并发起退款。
          </p>
        </Empty>
      </Card>

      <Spin v-else :spinning="loading">
        <Card :bordered="false" class="vip-refund-card">
          <template #title>订单列表</template>
          <template #extra>
            <Button size="small" @click="loadOrders">刷新</Button>
          </template>

          <Empty v-if="orders.length === 0" description="暂无会员支付订单" />

          <div v-else class="vip-refund-list">
            <article
              v-for="order in orders"
              :key="order.outTradeNo"
              class="vip-refund-item"
            >
              <div class="vip-refund-item__head">
                <div class="vip-refund-item__title">
                  <span class="vip-refund-item__order">
                    {{ order.outTradeNo }}
                  </span>
                  <Tag :color="getTradeStateView(order).color">
                    {{ getTradeStateView(order).label }}
                  </Tag>
                </div>
                <Button
                  class="vip-refund-item__action"
                  danger
                  :disabled="!order.refundable"
                  :loading="refundingOutTradeNo === order.outTradeNo"
                  @click="handleRefundOrder(order)"
                >
                  发起退款
                </Button>
              </div>

              <dl class="vip-refund-item__meta">
                <div>
                  <dt>支付金额</dt>
                  <dd>{{ formatMoney(order.amountTotal) }}</dd>
                </div>
                <div>
                  <dt>支付时间</dt>
                  <dd>{{ formatDate(order.paidAt) }}</dd>
                </div>
                <div>
                  <dt>权益开始</dt>
                  <dd>{{ formatDate(order.entitlement?.startAt) }}</dd>
                </div>
                <div>
                  <dt>权益结束</dt>
                  <dd>{{ formatDate(order.entitlement?.endAt) }}</dd>
                </div>
              </dl>

              <div class="vip-refund-item__tenant">
                <div>
                  <span>来源组织</span>
                  <strong>
                    {{
                      order.sourceOrganization?.name ||
                      (order.organizationProvisioningJob?.sourceOrgId
                        ? `组织 #${order.organizationProvisioningJob.sourceOrgId}`
                        : '-')
                    }}
                  </strong>
                  <small v-if="order.sourceOrganization?.sourceCustomerId">
                    {{ order.sourceOrganization.sourceCustomerId }}
                  </small>
                </div>
                <div>
                  <span>目标租户</span>
                  <strong>{{ order.targetCustomerId || '-' }}</strong>
                </div>
                <div>
                  <span>开通任务</span>
                  <strong v-if="order.organizationProvisioningJob">
                    #{{ order.organizationProvisioningJob.id }}
                    <Tag
                      class="vip-refund-item__job-tag"
                      :color="
                        getProvisioningStatusView(
                          order.organizationProvisioningJob.status,
                        ).color
                      "
                    >
                      {{
                        getProvisioningStatusView(
                          order.organizationProvisioningJob.status,
                        ).label
                      }}
                    </Tag>
                  </strong>
                  <strong v-else>-</strong>
                  <small
                    v-if="order.organizationProvisioningJob?.targetCustomerId"
                  >
                    {{ order.organizationProvisioningJob.targetCustomerId }}
                  </small>
                </div>
              </div>

              <div class="vip-refund-item__foot">
                <span v-if="order.transactionId">
                  微信流水号：{{ order.transactionId }}
                </span>
                <span v-if="order.refundDisabledReason">
                  {{ order.refundDisabledReason }}
                </span>
                <span
                  v-if="
                    order.latestRefund &&
                    order.latestRefund.status !== 'SUCCESS'
                  "
                >
                  退款单号：{{ order.latestRefund.outRefundNo }}
                </span>
              </div>
            </article>
          </div>
        </Card>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
.vip-refund-page {
  --refund-accent: #b45309;
  --refund-accent-soft: rgb(180 83 9 / 12%);
  --refund-border: rgb(15 23 42 / 8%);
  --refund-card: rgb(255 255 255 / 94%);
  --refund-muted: #667085;
  --refund-text: #152238;

  min-height: 100%;
  padding: 24px;
  color: var(--refund-text);
  background:
    radial-gradient(circle at 10% 0%, rgb(251 191 36 / 18%), transparent 30%),
    radial-gradient(circle at 90% 8%, rgb(14 165 233 / 14%), transparent 32%),
    linear-gradient(180deg, #fff8ed 0%, #f5f7fb 54%, #fff 100%);
}

.vip-refund-page__shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.vip-refund-page__back {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  padding: 0;
  margin-bottom: 18px;
  color: var(--refund-text);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.vip-refund-page__empty-desc {
  max-width: 420px;
  margin: 12px auto 0;
  line-height: 1.8;
  color: var(--refund-muted);
}

.vip-refund-hero {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 28px;
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 96%), rgb(255 250 241 / 92%)),
    #fff;
  border: 1px solid var(--refund-border);
  border-radius: 28px;
  box-shadow: 0 16px 42px rgb(15 23 42 / 8%);
}

.vip-refund-hero__eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  color: var(--refund-accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.vip-refund-hero h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.1;
}

.vip-refund-hero__desc {
  max-width: 680px;
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.9;
  color: var(--refund-muted);
}

.vip-refund-hero__stats {
  min-width: 158px;
  padding: 18px;
  text-align: center;
  background: var(--refund-accent-soft);
  border: 1px solid rgb(180 83 9 / 16%);
  border-radius: 22px;
}

.vip-refund-hero__stats span,
.vip-refund-hero__stats small {
  display: block;
  font-size: 13px;
  color: var(--refund-muted);
}

.vip-refund-hero__stats strong {
  display: block;
  margin: 8px 0;
  font-size: 34px;
  color: var(--refund-accent);
}

.vip-refund-card {
  overflow: hidden;
  background: var(--refund-card);
  border-radius: 24px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 5%);
}

.vip-refund-list {
  display: grid;
  gap: 14px;
}

.vip-refund-item {
  padding: 18px;
  background: linear-gradient(135deg, rgb(255 255 255 / 96%), #fffaf2);
  border: 1px solid var(--refund-border);
  border-radius: 20px;
}

.vip-refund-item__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.vip-refund-item__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.vip-refund-item__order {
  display: inline-flex;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 14px;
  font-weight: 800;
  color: var(--refund-accent);
  letter-spacing: 0.02em;
  word-break: break-all;
  background: var(--refund-accent-soft);
  border-radius: 999px;
}

.vip-refund-item__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}

.vip-refund-item__meta div {
  min-width: 0;
  padding: 12px;
  background: rgb(255 255 255 / 74%);
  border-radius: 14px;
}

.vip-refund-item__meta dt {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--refund-muted);
}

.vip-refund-item__meta dd {
  margin: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vip-refund-item__tenant {
  display: grid;
  grid-template-columns: minmax(180px, 1.3fr) minmax(160px, 1fr) minmax(
      180px,
      1fr
    );
  gap: 12px;
  padding: 12px;
  margin-top: 14px;
  background: rgb(23 100 255 / 5%);
  border: 1px solid rgb(23 100 255 / 10%);
  border-radius: 14px;
}

.vip-refund-item__tenant div {
  min-width: 0;
}

.vip-refund-item__tenant span,
.vip-refund-item__tenant small {
  display: block;
  font-size: 12px;
  color: var(--refund-muted);
}

.vip-refund-item__tenant strong {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  margin-top: 6px;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.vip-refund-item__tenant small {
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.vip-refund-item__job-tag {
  margin-inline-end: 0;
}

.vip-refund-item__foot {
  display: grid;
  gap: 6px;
  padding: 12px;
  margin-top: 14px;
  line-height: 1.7;
  color: var(--refund-muted);
  word-break: break-all;
  background: rgb(15 23 42 / 4%);
  border-radius: 14px;
}

.empty-icon {
  font-size: 72px;
  color: var(--refund-accent);
}

@media (max-width: 900px) {
  .vip-refund-page {
    padding: 16px;
  }

  .vip-refund-hero {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    padding: 20px;
    border-radius: 20px;
  }

  .vip-refund-hero h1 {
    font-size: 24px;
  }

  .vip-refund-hero__stats {
    padding: 16px;
  }

  .vip-refund-item {
    padding: 16px;
  }

  .vip-refund-item__head {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .vip-refund-item__action {
    width: 100%;
  }

  .vip-refund-item__meta {
    grid-template-columns: repeat(2, 1fr);
  }

  .vip-refund-item__meta dd {
    white-space: normal;
  }

  .vip-refund-item__tenant {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 500px) {
  .vip-refund-page {
    padding: 12px;
  }

  .vip-refund-item__meta {
    grid-template-columns: 1fr;
  }
}
</style>
