<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { AuthenticationProps } from './types';

import {
  computed,
  defineAsyncComponent,
  onMounted,
  ref,
  useTemplateRef,
} from 'vue';
import { useRouter } from 'vue-router';

import { $t } from '@vben/locales';

import Title from './auth-title.vue';

type AgreementModalType = 'privacy' | 'required' | 'service';

type CaptchaExpose = {
  resume: () => void;
};

type CopyrightInfo = {
  companyName?: string;
  date?: number | string;
  enable?: boolean;
  icp?: string;
  icpLink?: string;
};

defineOptions({
  name: 'AuthenticationLogin',
});

const props = withDefaults(
  defineProps<
    AuthenticationProps & {
      formSchema?: unknown[];
    }
  >(),
  {
    agreeAndContinueText: '',
    agreementRequiredMessage: '',
    agreementRequiredTitle: '',
    agreeText: '',
    andText: '',
    cancelText: '',
    codeLoginPath: '/auth/code-login',
    closeText: '',
    forgetPasswordPath: '/auth/forget-password',
    forgetPasswordText: '',
    formSchema: () => [],
    loading: false,
    mobileLoginText: '',
    privacyPolicyText: '',
    qrCodeLoginPath: '/auth/qrcode-login',
    registerPath: '/auth/register',
    rememberMeText: '',
    serviceAgreementText: '',
    showCodeLogin: true,
    showForgetPassword: true,
    showQrcodeLogin: true,
    showRegister: true,
    showRememberMe: true,
    showThirdPartyLogin: true,
    submitButtonText: '',
    subTitle: '',
    title: '',
  },
);

const emit = defineEmits<{
  submit: [Recordable<any>];
}>();

const AgreementModal = defineAsyncComponent(
  () => import('./agreement-modal.vue'),
);
const SliderCaptcha = defineAsyncComponent(
  () => import('../../components/captcha/slider-captcha/index.vue'),
);

const REMEMBER_ME_KEY_PREFIX = 'REMEMBER_ME_USERNAME_';
const REMEMBER_ME_KEY = `${REMEMBER_ME_KEY_PREFIX}${location.hostname}`;

const router = useRouter();
const captchaRef = useTemplateRef<CaptchaExpose>('captchaRef');

const username = ref('');
const password = ref('');
const captchaPassed = ref(false);
const rememberMe = ref(false);
const agreed = ref(false);
const submitted = ref(false);
const usernameTouched = ref(false);
const passwordTouched = ref(false);
const captchaTouched = ref(false);
const showAgreementModal = ref(false);
const agreementModalType = ref<AgreementModalType>('required');
const copyright = ref<CopyrightInfo | null>(null);

const usernameError = computed(() => {
  if (!submitted.value && !usernameTouched.value) {
    return '';
  }
  return username.value.trim()
    ? ''
    : localeText('authentication.usernameTip', '请输入用户名');
});

const passwordError = computed(() => {
  if (!submitted.value && !passwordTouched.value) {
    return '';
  }
  return password.value
    ? ''
    : localeText('authentication.passwordTip', '请输入密码');
});

const captchaError = computed(() => {
  if (!submitted.value && !captchaTouched.value) {
    return '';
  }
  return captchaPassed.value
    ? ''
    : localeText('authentication.verifyRequiredTip', '请先完成验证');
});

function localeText(key: string, fallback: string) {
  const text = $t(key);
  return text && text !== key ? text : fallback;
}

function propText(text: string | undefined, key: string, fallback: string) {
  return text || localeText(key, fallback);
}

function openAgreementModal(type: AgreementModalType) {
  agreementModalType.value = type;
  showAgreementModal.value = true;
}

function validateForm() {
  submitted.value = true;
  captchaTouched.value = true;
  return !usernameError.value && !passwordError.value && !captchaError.value;
}

function persistRememberMe() {
  try {
    localStorage.setItem(
      REMEMBER_ME_KEY,
      rememberMe.value ? username.value.trim() : '',
    );
  } catch (error) {
    console.warn('Failed to save remember me setting:', error);
  }
}

async function handleSubmit() {
  if (props.loading) {
    return;
  }

  if (!agreed.value) {
    openAgreementModal('required');
    return;
  }

  if (!validateForm()) {
    return;
  }

  persistRememberMe();
  emit('submit', {
    captcha: captchaPassed.value,
    password: password.value,
    username: username.value.trim(),
  });
}

function handleGo(path: string) {
  if (path === props.codeLoginPath && !agreed.value) {
    openAgreementModal('required');
    return;
  }
  router.push(path);
}

function showPrivacyPolicy() {
  openAgreementModal('privacy');
}

function showServiceAgreement() {
  openAgreementModal('service');
}

function handleAgreeAndClose() {
  agreed.value = true;
  showAgreementModal.value = false;
}

function showServiceAgreementFromTip() {
  openAgreementModal('service');
}

function showPrivacyPolicyFromTip() {
  openAgreementModal('privacy');
}

function resumeCaptcha() {
  captchaPassed.value = false;
  captchaTouched.value = false;
  captchaRef.value?.resume();
}

onMounted(() => {
  try {
    const savedUsername = localStorage.getItem(REMEMBER_ME_KEY) || '';
    if (savedUsername) {
      username.value = savedUsername;
      rememberMe.value = true;
    }
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
  }

  window.setTimeout(() => {
    void import('@vben-core/preferences').then(({ preferences }) => {
      copyright.value = preferences.copyright;
    });
  }, 1000);
});

defineExpose({
  getFormApi: () => ({
    getFieldComponentRef: (fieldName: string) =>
      fieldName === 'captcha' ? captchaRef.value : undefined,
    getValues: async () => ({
      captcha: captchaPassed.value,
      password: password.value,
      username: username.value.trim(),
    }),
    validate: async () => ({
      valid: validateForm(),
    }),
  }),
  resumeCaptcha,
});
</script>

<template>
  <div @keydown.enter.prevent="handleSubmit">
    <slot name="title">
      <Title>
        <slot name="title">
          {{
            title ||
            `${localeText('authentication.welcomeBack', '欢迎回来')} 👋🏻`
          }}
        </slot>
        <template #desc>
          <span class="text-muted-foreground">
            <slot name="subTitle">
              {{
                subTitle ||
                localeText(
                  'authentication.loginSubtitle',
                  '请输入您的帐户信息以开始管理您的项目',
                )
              }}
            </slot>
          </span>
        </template>
      </Title>
    </slot>

    <div class="mb-4 space-y-4">
      <div>
        <label class="sr-only" for="auth-login-username">
          {{ localeText('authentication.username', '账号') }}
        </label>
        <input
          id="auth-login-username"
          v-model="username"
          autocomplete="username"
          class="auth-input"
          :class="{ 'auth-input--error': usernameError }"
          :disabled="loading"
          :placeholder="
            localeText('authentication.usernameTip', '请输入用户名')
          "
          type="text"
          @blur="usernameTouched = true"
        />
        <p v-if="usernameError" class="auth-field-error">
          {{ usernameError }}
        </p>
      </div>

      <div>
        <label class="sr-only" for="auth-login-password">
          {{ localeText('authentication.password', '密码') }}
        </label>
        <input
          id="auth-login-password"
          v-model="password"
          autocomplete="current-password"
          class="auth-input"
          :class="{ 'auth-input--error': passwordError }"
          :disabled="loading"
          :placeholder="localeText('authentication.password', '密码')"
          type="password"
          @blur="passwordTouched = true"
        />
        <p v-if="passwordError" class="auth-field-error">
          {{ passwordError }}
        </p>
      </div>

      <div>
        <SliderCaptcha
          ref="captchaRef"
          v-model="captchaPassed"
          :success-text="localeText('ui.captcha.sliderSuccessText', '验证通过')"
          :text="localeText('ui.captcha.sliderDefaultText', '请按住滑块拖动')"
          @end="captchaTouched = true"
        />
        <p v-if="captchaError" class="auth-field-error">
          {{ captchaError }}
        </p>
      </div>
    </div>

    <div
      v-if="showRememberMe || showForgetPassword"
      class="mb-4 flex items-center justify-between gap-3"
    >
      <label
        v-if="showRememberMe"
        class="auth-checkbox"
        for="auth-login-remember"
      >
        <input
          id="auth-login-remember"
          v-model="rememberMe"
          class="auth-checkbox-input"
          :disabled="loading"
          type="checkbox"
        />
        <span aria-hidden="true" class="auth-checkbox-box"></span>
        <span class="auth-checkbox-text">
          {{
            propText(rememberMeText, 'authentication.rememberMe', '记住账号')
          }}
        </span>
      </label>

      <span
        v-if="showForgetPassword"
        class="vben-link text-sm font-normal"
        @click="handleGo(forgetPasswordPath)"
      >
        {{
          propText(
            forgetPasswordText,
            'authentication.forgetPassword',
            '忘记密码?',
          )
        }}
      </span>
    </div>

    <div class="mb-4 flex flex-col">
      <label class="auth-checkbox" for="auth-login-agreement">
        <input
          id="auth-login-agreement"
          v-model="agreed"
          class="auth-checkbox-input"
          :disabled="loading"
          type="checkbox"
        />
        <span aria-hidden="true" class="auth-checkbox-box"></span>
        <span class="auth-checkbox-text">
          {{ propText(agreeText, 'authentication.agree', '我同意') }}
          <span
            class="vben-link cursor-pointer"
            @click.stop.prevent="showServiceAgreement"
          >
            《{{
              propText(
                serviceAgreementText,
                'authentication.serviceAgreement',
                '服务协议',
              )
            }}》
          </span>
          {{ propText(andText, 'common.and', '和') }}
          <span
            class="vben-link cursor-pointer"
            @click.stop.prevent="showPrivacyPolicy"
          >
            《{{
              propText(
                privacyPolicyText,
                'authentication.privacyPolicy',
                '隐私协议',
              )
            }}》
          </span>
        </span>
      </label>
    </div>

    <div
      v-if="showCodeLogin || showQrcodeLogin"
      class="mb-2 mt-4 flex items-center justify-between"
    >
      <button
        v-if="showCodeLogin"
        class="auth-button auth-button--outline"
        :disabled="loading"
        type="button"
        @click="handleGo(codeLoginPath)"
      >
        {{
          propText(mobileLoginText, 'authentication.mobileLogin', '手机号登录')
        }}
      </button>
    </div>

    <button
      aria-label="login"
      class="auth-button auth-button--primary"
      :class="{ 'cursor-wait': loading }"
      :disabled="loading"
      type="button"
      @click="handleSubmit"
    >
      <span v-if="loading" class="auth-spinner"></span>
      {{ submitButtonText || localeText('common.login', '登录') }}
    </button>

    <div
      v-if="copyright?.enable && copyright.icp"
      class="mt-8 flex flex-col items-center justify-center pb-6 text-xs text-gray-400"
    >
      <a
        :href="copyright.icpLink || 'https://beian.miit.gov.cn/'"
        class="hover:text-primary mb-1 text-gray-400 no-underline"
        target="_blank"
      >
        {{ copyright.icp }}
      </a>
      <div>Copyright © {{ copyright.date }} {{ copyright.companyName }}</div>
    </div>

    <AgreementModal
      v-if="showAgreementModal"
      v-model:open="showAgreementModal"
      :agree-and-continue-text="agreeAndContinueText"
      :agreement-required-message="agreementRequiredMessage"
      :agreement-required-title="agreementRequiredTitle"
      :and-text="andText"
      :cancel-text="cancelText"
      :close-text="closeText"
      :privacy-policy-text="privacyPolicyText"
      :service-agreement-text="serviceAgreementText"
      :type="agreementModalType"
      @agree="handleAgreeAndClose"
      @open-privacy="showPrivacyPolicyFromTip"
      @open-service="showServiceAgreementFromTip"
    />
  </div>
</template>

<style scoped>
.auth-input {
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.auth-input::placeholder {
  color: hsl(var(--muted-foreground));
}

.auth-input:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 16%);
}

.auth-input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.auth-input--error {
  border-color: hsl(var(--destructive));
}

.auth-field-error {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--destructive));
}

.auth-checkbox {
  position: relative;
  display: inline-flex;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
  line-height: 20px;
  cursor: pointer;
  user-select: none;
}

.auth-checkbox-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: 0;
  overflow: hidden;
  opacity: 0;
}

.auth-checkbox-box {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  box-shadow: 0 1px 2px hsl(var(--foreground) / 6%);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.auth-checkbox-box::after {
  display: block;
  width: 4px;
  height: 8px;
  margin: 2px 0 0 5px;
  content: '';
  border: solid hsl(var(--primary-foreground));
  border-width: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.12s ease;
  transform: rotate(45deg) scale(0.85);
}

.auth-checkbox-input:checked + .auth-checkbox-box {
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  box-shadow: 0 2px 6px hsl(var(--primary) / 20%);
}

.auth-checkbox-input:checked + .auth-checkbox-box::after {
  opacity: 1;
}

.auth-checkbox-input:focus-visible + .auth-checkbox-box {
  box-shadow:
    0 0 0 2px hsl(var(--background)),
    0 0 0 4px hsl(var(--primary) / 28%);
}

.auth-checkbox-input:disabled + .auth-checkbox-box,
.auth-checkbox-input:disabled ~ .auth-checkbox-text {
  cursor: not-allowed;
  opacity: 0.58;
}

.auth-checkbox-text {
  min-width: 0;
  font-size: 13.8px;
  font-weight: 400;
  line-height: 20px;
  color: hsl(var(--muted-foreground) / 82%);
}

.auth-checkbox-text .vben-link {
  font-size: inherit;
  font-weight: 400;
  color: hsl(var(--primary) / 76%);
}

.auth-checkbox-text .vben-link:hover {
  color: hsl(var(--primary) / 88%);
}

.auth-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  border-radius: 6px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    opacity 0.18s ease;
}

.auth-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.auth-button--primary {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border: 1px solid hsl(var(--primary));
}

.auth-button--outline {
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
}

.auth-button--outline:not(:disabled):hover {
  background: hsl(var(--accent));
}

.auth-spinner {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: auth-spin 0.8s linear infinite;
}

@keyframes auth-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
