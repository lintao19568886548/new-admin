<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, Card, message, Tag } from 'ant-design-vue';

defineOptions({ name: 'VipMembershipPage' });

const router = useRouter();
const userStore = useUserStore();

const userInfo = computed(() => userStore.userInfo);
const membershipStatusText = computed(() => '未开通');
const payButtonText = computed(() => '支付 ¥980/月');

function handleGoBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  void router.push('/profile');
}

function handleMockPay() {
  message.info('会员支付功能待接入，当前先展示开通页面效果');
}
</script>

<template>
  <div class="vip-membership-page">
    <button
      class="vip-membership-page__back"
      type="button"
      @click="handleGoBack"
    >
      <VbenIcon icon="mdi:arrow-left" class="size-4" />
      <span>返回个人中心</span>
    </button>

    <section class="vip-hero">
      <div class="vip-hero__copy">
        <p class="vip-hero__eyebrow">VIP Membership</p>
        <h1>会员服务</h1>
        <p class="vip-hero__description">
          为 {{ userInfo?.realName || '当前账号' }}
          开通月度会员后，可进入后续扩展的专属功能与服务能力。
        </p>
      </div>

      <div class="vip-hero__price-panel">
        <Tag color="gold">{{ membershipStatusText }}</Tag>
        <div class="vip-hero__price">
          <span class="vip-hero__price-value">¥980</span>
          <span class="vip-hero__price-unit">/月</span>
        </div>
        <p class="vip-hero__price-caption">
          当前阶段先完成页面展示，后续再接入真实支付与订阅能力。
        </p>
      </div>
    </section>

    <div class="vip-membership-page__grid">
      <Card :bordered="false" class="vip-card">
        <template #title>会员权益</template>
        <div class="benefit-list">
          <div class="benefit-item">
            <strong>会员专属入口</strong>
            <span>为后续 VIP 专属功能预留统一开通入口和独立服务页。</span>
          </div>
          <div class="benefit-item">
            <strong>功能扩展承接</strong>
            <span>后续新增会员能力时，可直接承接到当前会员服务页。</span>
          </div>
          <div class="benefit-item">
            <strong>统一开通体验</strong>
            <span>目前先固定展示标准方案价格，后续接入真实商店支付。</span>
          </div>
        </div>
      </Card>

      <Card :bordered="false" class="vip-card vip-card--purchase">
        <template #title>开通会员</template>
        <div class="purchase-panel">
          <div class="purchase-panel__summary">
            <p class="purchase-panel__title">VIP 月度会员</p>
            <p class="purchase-panel__description">
              标准方案价格为
              ¥980/月。当前版本先提供页面展示与按钮交互，实际支付流程后续接入。
            </p>
          </div>

          <div class="purchase-panel__status">
            <span>当前状态</span>
            <strong>{{ membershipStatusText }}</strong>
          </div>

          <Button block size="large" type="primary" @click="handleMockPay">
            {{ payButtonText }}
          </Button>

          <p class="purchase-panel__hint">
            点击支付后当前仅提示“待接入”，不会发起真实扣款。
          </p>
        </div>
      </Card>

      <Card :bordered="false" class="vip-card vip-card--notice">
        <template #title>说明</template>
        <div class="notice-list">
          <p>当前价格展示为固定方案价：¥980/月。</p>
          <p>当前版本重点是会员服务入口、开通页和交互路径打通。</p>
          <p>真实支付、订阅状态同步和恢复购买能力后续再接入。</p>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.vip-membership-page {
  --vip-bg: linear-gradient(180deg, #f6efe1 0%, #f3f5f7 42%, #fff 100%);
  --vip-accent: #9d6b00;
  --vip-accent-strong: #5f4200;
  --vip-border: rgb(157 107 0 / 14%);
  --vip-shadow: 0 18px 42px rgb(67 45 0 / 8%);

  min-height: 100%;
  padding: 16px;
  background: var(--vip-bg);
}

.vip-membership-page__back {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: #5f4200;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.vip-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(240px, 360px);
  gap: 20px;
  padding: 24px;
  margin-top: 16px;
  background:
    radial-gradient(
      circle at top right,
      rgb(255 233 175 / 72%),
      transparent 36%
    ),
    linear-gradient(135deg, rgb(255 248 226 / 94%), rgb(255 255 255 / 92%));
  border: 1px solid var(--vip-border);
  border-radius: 24px;
  box-shadow: var(--vip-shadow);
}

.vip-hero__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vip-accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.vip-hero h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: #2c1d00;
}

.vip-hero__description {
  max-width: 460px;
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.7;
  color: rgb(44 29 0 / 76%);
}

.vip-hero__price-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: space-between;
  padding: 20px;
  background: rgb(255 255 255 / 76%);
  border-radius: 20px;
}

.vip-hero__price {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  color: var(--vip-accent-strong);
}

.vip-hero__price-value {
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
}

.vip-hero__price-unit {
  padding-bottom: 4px;
  font-size: 16px;
}

.vip-hero__price-caption {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: rgb(44 29 0 / 68%);
}

.vip-membership-page__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.vip-card {
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 60%);
  border-radius: 22px;
  box-shadow: 0 10px 32px rgb(15 23 42 / 6%);
}

.vip-card--purchase {
  background: linear-gradient(180deg, rgb(255 255 255 / 96%), #fff8ec 100%);
}

.benefit-list,
.notice-list,
.purchase-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.benefit-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: rgb(246 239 225 / 70%);
  border-radius: 16px;
}

.benefit-item strong {
  font-size: 15px;
  color: #3f2a00;
}

.benefit-item span,
.notice-list p,
.purchase-panel__description,
.purchase-panel__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgb(46 32 3 / 72%);
}

.purchase-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #2c1d00;
}

.purchase-panel__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(157 107 0 / 12%);
  border-radius: 16px;
}

.purchase-panel__status span {
  font-size: 13px;
  color: rgb(46 32 3 / 56%);
}

.purchase-panel__status strong {
  font-size: 14px;
  font-weight: 600;
  color: #3f2a00;
}

@media (max-width: 960px) {
  .vip-hero,
  .vip-membership-page__grid {
    grid-template-columns: 1fr;
  }

  .vip-hero {
    padding: 20px;
  }

  .vip-hero h1 {
    font-size: 28px;
  }
}
</style>
