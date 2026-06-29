<script lang="ts" setup>
import type { ResolveCrmInviteResponse } from '#/api/crm';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Input, message, Spin } from 'ant-design-vue';

import { resolveCrmInviteApi } from '#/api/crm';
import { isWechatBrowser } from '#/utils/wechat-jssdk';

const route = useRoute();

const productValues = [
  {
    label: '抄表 / 开单 / 催费',
    value: '2-4人减至0.5人',
  },
  {
    label: '合同到期',
    value: '提前90天预警',
  },
  {
    label: '空置房源去化',
    value: '1-2个月',
  },
  {
    label: '租金收缴率',
    value: '提升至98%以上',
  },
  {
    label: '能耗管理',
    value: '自动抄表 + 异常报警',
  },
];

const editionPrices = [
  { label: '基础版', value: '9800元' },
  { label: '标准版', value: '12800元' },
  { label: '集团版', value: '36800元' },
];

const loading = ref(false);
const result = ref<null | ResolveCrmInviteResponse>(null);
const errorMessage = ref('');
const oauthError = ref('');
const customerAddress = ref('');
const customerName = ref('');
const phone = ref('');
const openid = ref('');
const unionid = ref('');
const isWechat = ref(false);

const scene = computed(() =>
  String(route.query.scene || route.query.s || '').trim(),
);

const contactQrCode = computed(
  () =>
    result.value?.owner.contactQrCode || result.value?.contactWay?.qrCode || '',
);

const ownerName = computed(
  () => result.value?.owner.salesName || result.value?.channel.salesName || '',
);

const resolvedCustomerName = computed(
  () =>
    result.value?.binding?.customerName ||
    maskPhone(result.value?.binding?.phone) ||
    displayWechatIdentity({
      openid: result.value?.binding?.openid,
      unionid: result.value?.binding?.unionid,
    }) ||
    '',
);

const hasBoundCustomer = computed(() => Boolean(result.value?.binding));

const fallbackChannelName = computed(
  () => result.value?.channel.channelName || '',
);

const canFillLeadForm = computed(() =>
  Boolean(phone.value || openid.value || unionid.value),
);

function getQueryValue(name: string) {
  return String(route.query[name] || '').trim();
}

function normalizePhone(value: string) {
  return value.replaceAll(/\D/g, '');
}

function maskIdentity(value?: null | string) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  return text.length > 10 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
}

function maskPhone(value?: null | string) {
  const text = String(value || '').trim();
  return /^\d{11}$/.test(text)
    ? `${text.slice(0, 3)}****${text.slice(-4)}`
    : text;
}

function displayWechatIdentity(record: {
  openid?: null | string;
  unionid?: null | string;
}) {
  const unionidText = maskIdentity(record.unionid);
  if (unionidText) {
    return `UnionID ${unionidText}`;
  }
  const openidText = maskIdentity(record.openid);
  return openidText ? `OpenID ${openidText}` : '';
}

async function resolveInvite(options: { silent?: boolean } = {}) {
  errorMessage.value = '';
  if (!scene.value) {
    errorMessage.value = '二维码参数缺失，请重新扫码';
    return;
  }

  const payload = {
    customerAddress:
      customerAddress.value.trim() || getQueryValue('customerAddress'),
    customerName: customerName.value.trim() || getQueryValue('customerName'),
    openid: openid.value || getQueryValue('openid'),
    phone: normalizePhone(phone.value || getQueryValue('phone')),
    scene: scene.value,
    source: getQueryValue('source') || 'h5',
    unionid: unionid.value || getQueryValue('unionid'),
  };
  customerAddress.value = payload.customerAddress;
  customerName.value = payload.customerName;
  phone.value = payload.phone;

  if (
    !options.silent &&
    (!payload.customerName || !payload.phone || !payload.customerAddress)
  ) {
    errorMessage.value = '请填写姓名、手机号和详细地址';
    return;
  }
  if (!options.silent && payload.phone && !/^\d{11}$/.test(payload.phone)) {
    errorMessage.value = '请输入正确的 11 位手机号';
    return;
  }

  loading.value = true;
  try {
    result.value = await resolveCrmInviteApi(payload);
    if (result.value.contactWayError) {
      message.warning(result.value.contactWayError);
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '解析销售归属失败';
  } finally {
    loading.value = false;
  }
}

function openWechatOAuth() {
  if (!scene.value) return;
  const url = `/api/crm/invite/wechat-oauth/start?scene=${encodeURIComponent(scene.value)}`;
  window.location.href = url;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  bad_scene: '邀请链接参数异常，请重新扫码获取',
  denied: '您取消了微信授权，请重试',
  failed: '微信授权失败，请稍后重试',
  not_configured: '当前系统暂未开通微信网页授权',
};

async function initializeInvitePage() {
  isWechat.value = isWechatBrowser();
  customerAddress.value = getQueryValue('customerAddress');
  customerName.value = getQueryValue('customerName');
  phone.value = getQueryValue('phone');
  openid.value = getQueryValue('openid');
  unionid.value = getQueryValue('unionid');

  const rawOauthError = getQueryValue('oauth_error');
  if (rawOauthError) {
    oauthError.value =
      OAUTH_ERROR_MESSAGES[rawOauthError] || `微信授权失败（${rawOauthError}）`;
  }

  if (!scene.value) {
    return;
  }

  if (canFillLeadForm.value) {
    return;
  }

  await resolveInvite({ silent: true });
}

onMounted(() => {
  void initializeInvitePage();
});
</script>

<template>
  <main class="crm-invite-page">
    <section class="invite-shell">
      <div class="poster-panel">
        <div class="brand-row">
          <div class="brand-mark">瞰</div>
          <div>
            <div class="brand">瞰维智管</div>
            <div class="brand-subtitle">园区数字化运营平台</div>
          </div>
        </div>

        <div class="hero-copy">
          <span>智慧园区一体化管理系统</span>
          <h1>全流程数字化管控，让园区运营降本增效</h1>
        </div>

        <div class="value-grid">
          <div
            v-for="item in productValues"
            :key="item.label"
            class="value-card"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="price-grid">
          <div v-for="item in editionPrices" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>

      <section class="action-panel">
        <Spin :spinning="loading">
          <template v-if="result && hasBoundCustomer">
            <div class="status-pill">
              {{ result.isFirstBind ? '已锁定专属顾问' : '已匹配原归属顾问' }}
            </div>

            <h2>{{ ownerName || '专属销售顾问' }}</h2>
            <p class="subtext">
              客户信息已记录，后续咨询、演示和服务都会归属这位顾问，重复扫码不会自动更换销售。
            </p>

            <div class="owner-card">
              <div>
                <span>客户</span>
                <strong>{{ resolvedCustomerName || '-' }}</strong>
              </div>
              <div>
                <span>归属销售</span>
                <strong>{{ ownerName || '-' }}</strong>
              </div>
              <div>
                <span>来源渠道</span>
                <strong>{{ result.channel.channelName || '-' }}</strong>
              </div>
              <div>
                <span>手机号</span>
                <strong>{{ maskPhone(result.binding?.phone) || '-' }}</strong>
              </div>
              <div class="owner-card-wide">
                <span>详细地址</span>
                <strong>{{ result.binding?.customerAddress || '-' }}</strong>
              </div>
              <div>
                <span>微信标识</span>
                <strong>
                  {{ displayWechatIdentity(result.binding || {}) || '-' }}
                </strong>
              </div>
            </div>

            <div v-if="contactQrCode" class="qr-block">
              <img :src="contactQrCode" alt="企业微信联系二维码" />
              <span>长按识别二维码添加企业微信</span>
            </div>

            <div v-else class="empty-contact">
              <strong>企业微信联系码暂未配置</strong>
              <span>可先下载APP，或直接拨打顾问电话继续咨询。</span>
            </div>

            <div class="actions">
              <a class="primary-link" href="/app/download">下载APP继续使用</a>
              <a
                v-if="result.owner.phone"
                class="secondary-link"
                :href="`tel:${result.owner.phone}`"
              >
                拨打电话
              </a>
            </div>
          </template>

          <template v-else>
            <div class="status-pill">领取专属服务</div>

            <h2>授权领取专属服务</h2>
            <p class="subtext">
              请留下您的联系方式，以便我们的销售团队联系到您，感谢您的支持，我们稍后联系您
            </p>
            <div v-if="ownerName || fallbackChannelName" class="lead-preview">
              <div v-if="ownerName">
                <span>专属顾问</span>
                <strong>{{ ownerName }}</strong>
              </div>
              <div v-if="fallbackChannelName">
                <span>来源渠道</span>
                <strong>{{ fallbackChannelName }}</strong>
              </div>
            </div>

            <!-- 微信内：优先用 H5 OAuth（公众号授权），无需跳转小程序 -->
            <template v-if="isWechat && !openid && !unionid">
              <button
                class="primary-link button-link"
                :disabled="!scene"
                type="button"
                @click="openWechatOAuth"
              >
                微信一键授权
              </button>
              <p v-if="oauthError" class="helper-text error-text">
                {{ oauthError }}
              </p>
              <p v-else class="helper-text">
                点击授权后系统将获取您的微信身份，完成专属顾问绑定。
              </p>
            </template>

            <form
              v-if="canFillLeadForm"
              class="lead-form"
              @submit.prevent="resolveInvite()"
            >
              <label>
                <span>姓名</span>
                <Input
                  v-model:value="customerName"
                  allow-clear
                  placeholder="请输入您的姓名"
                />
              </label>
              <label>
                <span>手机号</span>
                <Input
                  v-model:value="phone"
                  allow-clear
                  inputmode="tel"
                  :maxlength="11"
                  placeholder="请输入 11 位手机号"
                />
              </label>
              <label>
                <span>详细地址</span>
                <Input.TextArea
                  v-model:value="customerAddress"
                  :auto-size="{ minRows: 2, maxRows: 4 }"
                  :maxlength="255"
                  allow-clear
                  placeholder="请输入详细地址"
                  show-count
                />
              </label>
              <button
                class="primary-link button-link"
                :disabled="!scene || loading"
                type="submit"
              >
                提交信息
              </button>
            </form>

            <!-- 非微信环境：保留 H5 链接，提示用户用微信打开后走 OAuth -->
            <template v-if="!isWechat && !canFillLeadForm">
              <p class="helper-text">
                当前不在微信内，请将链接复制到微信后打开，或使用微信扫描推广海报二维码。
              </p>
            </template>

            <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
          </template>
        </Spin>
      </section>
    </section>
  </main>
</template>

<style scoped>
.crm-invite-page {
  min-height: 100vh;
  padding: 28px;
  color: #172033;
  background:
    linear-gradient(
      180deg,
      rgb(227 244 255 / 90%) 0%,
      rgb(255 255 255 / 96%) 62%
    ),
    #f4f9ff;
}

.invite-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(360px, 0.96fr);
  gap: 0;
  align-items: center;
  width: min(100%, 1040px);
  min-height: calc(100vh - 56px);
  margin: 0 auto;
  overflow: hidden;
  background: rgb(255 255 255 / 97%);
  border: 1px solid #dce7f5;
  border-radius: 8px;
  box-shadow: 0 18px 50px rgb(15 35 70 / 12%);
}

.poster-panel,
.action-panel {
  min-width: 0;
  padding: 30px;
  background: transparent;
}

.poster-panel {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fcff 0%, #eef7ff 100%);
}

.brand-row {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  align-items: center;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  background: #1677ff;
  border-radius: 8px;
}

.brand {
  font-size: 18px;
  font-weight: 600;
  color: #173b63;
}

.brand-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7788;
}

.hero-copy {
  position: relative;
  z-index: 1;
  margin-top: 44px;
}

.hero-copy span {
  font-size: 15px;
  font-weight: 700;
  color: #1677ff;
}

h1,
h2 {
  margin: 0;
  font-weight: 700;
  line-height: 1.25;
}

h1 {
  max-width: 520px;
  margin-top: 10px;
  font-size: 38px;
}

h2 {
  font-size: 26px;
}

.subtext {
  margin: 10px 0 20px;
  font-size: 14px;
  line-height: 1.7;
  color: #526277;
}

.value-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 34px;
}

.value-card {
  display: grid;
  gap: 6px;
  align-content: center;
  min-height: 82px;
  padding: 14px;
  background: #f6fbff;
  border: 1px solid #dcecfb;
  border-radius: 8px;
}

.value-card span,
.price-grid span {
  font-size: 13px;
  color: #617188;
}

.value-card strong {
  font-size: 18px;
  color: #0f6fbd;
  overflow-wrap: anywhere;
}

.price-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.price-grid div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 12px 10px;
  text-align: center;
  background: #eef7ff;
  border: 1px solid #d2e7fb;
  border-radius: 8px;
}

.price-grid strong {
  font-size: 16px;
  color: #0f5fa8;
  overflow-wrap: anywhere;
}

.status-pill {
  display: inline-flex;
  padding: 4px 10px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #0f766e;
  background: #dff7f2;
  border-radius: 999px;
}

.action-panel {
  align-self: stretch;
  background: #fff;
}

.action-panel > :deep(.ant-spin-nested-loading),
.action-panel > :deep(.ant-spin-nested-loading > div),
.action-panel > :deep(.ant-spin-container) {
  height: 100%;
}

.action-panel :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.owner-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 14px;
  margin: 18px 0;
  background: #f7fbff;
  border: 1px solid #e4edf7;
  border-radius: 8px;
}

.owner-card div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.owner-card-wide {
  grid-column: 1 / -1;
}

.owner-card span {
  font-size: 12px;
  color: #6b7788;
}

.owner-card strong {
  font-size: 15px;
  overflow-wrap: anywhere;
}

.qr-block {
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 18px;
  margin: 18px 0;
  background: #fff;
  border: 1px solid #e4edf7;
  border-radius: 8px;
}

.qr-block img {
  width: min(100%, 240px);
  height: auto;
}

.qr-block span,
.empty-contact {
  font-size: 13px;
  color: #526277;
}

.empty-contact {
  display: grid;
  gap: 6px;
  padding: 16px;
  margin: 18px 0;
  text-align: center;
  background: #f6f8fb;
  border: 1px dashed #d7e2f0;
  border-radius: 8px;
}

.empty-contact strong {
  color: #172033;
}

.actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.lead-form {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.lead-form label {
  display: grid;
  gap: 6px;
}

.lead-form label > span {
  font-size: 13px;
  font-weight: 600;
  color: #314159;
}

.primary-link,
.secondary-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 10px 12px;
  text-decoration: none;
  border-radius: 6px;
}

.primary-link {
  color: #fff;
  background: #1677ff;
}

.secondary-link {
  color: #1677ff;
  background: #eef5ff;
  border: 1px solid #cfe0ff;
}

.button-link {
  width: 100%;
  margin-bottom: 12px;
  font: inherit;
  cursor: pointer;
  border: 0;
}

.button-link:disabled {
  cursor: default;
  opacity: 0.78;
}

.helper-text {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #8a5a00;
}

.error {
  margin: 12px 0 0;
  font-size: 13px;
  color: #c2410c;
}

.error-text {
  color: #c2410c;
}

@media (max-width: 480px) {
  .crm-invite-page {
    padding: 16px;
  }

  .invite-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .poster-panel,
  .action-panel {
    padding: 18px;
  }

  .hero-copy {
    margin-top: 32px;
  }

  h1 {
    font-size: 30px;
  }

  h2 {
    font-size: 24px;
  }

  .value-grid,
  .actions,
  .owner-card {
    grid-template-columns: 1fr;
  }

  .price-grid {
    gap: 8px;
  }

  .price-grid div {
    padding: 10px 6px;
  }

  .price-grid strong {
    font-size: 14px;
  }
}
</style>
