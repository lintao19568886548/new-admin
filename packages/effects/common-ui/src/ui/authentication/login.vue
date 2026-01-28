<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '@vben-core/form-ui';

import type { AuthenticationProps } from './types';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm } from '@vben-core/form-ui';
import { preferences } from '@vben-core/preferences';
import { VbenButton, VbenCheckbox } from '@vben-core/shadcn-ui';

import Title from './auth-title.vue';

defineOptions({
  name: 'AuthenticationLogin',
});

const props = withDefaults(
  defineProps<
    AuthenticationProps & {
      formSchema: VbenFormSchema[];
    }
  >(),
  {
    codeLoginPath: '/auth/code-login',
    forgetPasswordPath: '/auth/forget-password',
    formSchema: () => [],
    loading: false,
    qrCodeLoginPath: '/auth/qrcode-login',
    registerPath: '/auth/register',
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

// 常量定义
const REMEMBER_ME_KEY_PREFIX = 'REMEMBER_ME_USERNAME_';
const PRIVACY_POLICY_MODAL_MAX_HEIGHT = 'max-h-96';
const PRIVACY_POLICY_MODAL_MAX_WIDTH = 'max-w-4xl';

const [Form, formApi] = useVbenForm(
  reactive({
    commonConfig: {
      hideLabel: true,
      hideRequiredMark: true,
    },
    schema: computed(() => props.formSchema),
    showDefaultActions: false,
  }),
);
const router = useRouter();

// 使用常量构建localStorage key
const REMEMBER_ME_KEY = `${REMEMBER_ME_KEY_PREFIX}${location.hostname}`;

// 响应式数据
const rememberMe = ref(false);
const showPrivacyModal = ref(false);
const showServiceAgreementModal = ref(false);

// 计算属性：获取本地存储的用户名
const localUsername = computed(() => {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) || '';
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return '';
  }
});

// 计算属性：隐私政策内容
const privacyPolicyContent = computed(() => {
  return `隐私协议

一、引言
感谢您选择使用我们的APP（以下简称“本APP”）。我们非常重视您的隐私和个人信息保护，特此制定本隐私协议（以下简称“本协议”），以向您说明我们如何收集、使用、存储和保护您的个人信息。 请您在使用本APP前仔细阅读本协议，理解并同意我们的个人信息处理规则后再进行使用。如果您不同意本协议中的任何条款，请立即停止使用本APP。
二、信息收集
我们可能收集您在使用本APP过程中主动提供的个人信息，包括但不限于姓名、性别、年龄、生日、联系方式（如电话号码、电子邮箱地址）、地址、账号密码、设备信息（如设备型号、操作系统版本、IP地址、MAC地址等）、位置信息（如通过GPS、蓝牙等获取的位置信息）、浏览记录、搜索记录、交易记录等。 我们可能通过自动化手段收集您的设备信息、使用行为信息、日志信息等。 我们可能获取您的设备ID，用于调整页面兼容性，提供更好的使用体验。 我们可能获取您的ANDROID ID，用于消息的定向推送。
三、信息存储与保护
我们将采取必要的技术和管理措施，确保您的个人信息在收集、传输、存储和使用过程中的安全性。 我们将按照法律法规要求，对您的个人信息进行匿名化或去标识化处理，以降低信息泄露风险。 我们将定期对个人信息存储系统进行安全审计，及时发现并修复潜在的安全漏洞。
四、信息披露与共享
除非得到您的明确同意，或根据法律法规要求，我们不会向第三方披露您的个人信息。 在以下情况下，我们可能向第三方共享您的个人信息： 与我们合作的第三方服务提供商，为向您提供服务而必须访问您的个人信息； 在法律法规要求或政府主管部门要求的情况下，向相关部门提供您的个人信息； 在涉及合并、收购、资产转让等交易时，向交易对方披露您的个人信息。
五、用户权利
您有权查询、更正、删除您的个人信息。您可以通过APP内的设置选项或联系我们的客服部门行使上述权利。 您有权撤回对个人信息处理的同意。但请注意，撤回同意可能导致您无法继续使用本APP的某些功能或服务。 您有权投诉。如果您认为我们违反了本协议或相关法律法规，您有权向我们投诉。我们将尽快处理您的投诉，并告知您处理结果。
六、协议变更与终止
我们可能根据法律法规变化或业务需要，对本协议进行修订。修订后的协议将在APP内公示，您继续使用本APP即视为同意修订后的协议。 您有权随时终止本协议并停止使用本APP。您可以通过卸载APP或联系我们的客服部门行使该权利。
七、适用法律与争议解决
本协议的订立、执行和解释以及争议的解决均应适用中华人民共和国法律。 如因本协议产生争议，双方应友好协商解决。协商不成的，任何一方均有权向本APP运营者所在地有管辖权的人民法院提起诉讼。
八、开发者信息
东莞市宜租网络有限有限公司
九、其他
本协议自您使用本APP之日起生效，并对您在本APP上的所有行为具有约束力。请您务必仔细阅读并理解本协议的全部内容。
`;
});

// 计算属性：服务协议内容
const serviceAgreementContent = computed(() => {
  return `服务协议

1. 引言

本服务协议（以下简称“协议”）是东莞市宜租网络科技有限公司（以下简称“宜租网络”或“我们”）与您之间就您使用园区管理软件服务（以下简称“服务”）所达成的协议。请您仔细阅读本协议的全部内容，特别是关于免责条款、知识产权和争议解决等重要条款。

2. 定义

“服务”指宜租网络提供的园区管理软件及相关服务。
“用户”指使用服务的个人或单位。
“园区”指用户管理的园区。
3. 服务内容

宜租网络提供以下服务：

园区基础管理功能，如园区信息管理、用户管理、设施管理、安全监控等。
数据分析服务，如用户行为分析、设施使用情况分析等。
客户支持服务，包括在线帮助、电话支持等。
4. 用户责任

用户应遵守国家法律法规和本协议的约定。
用户应对其使用服务的行为负责，并保证其信息的真实性、准确性和完整性。
用户不得利用服务从事任何违法活动。
5. 宜租网络的权利

宜租网络有权随时修改、暂停或终止服务。
宜租网络有权对用户的使用行为进行监控和记录。
宜租网络有权根据法律法规和本协议的约定，对用户的违规行为进行处理。
6. 知识产权

服务中包含的软件、文字、图片、视频等知识产权归宜租网络所有。
用户不得未经授权复制、传播、修改或使用服务中的知识产权。
7. 免责条款

宜租网络不对服务的可用性、准确性、安全性等做出任何保证。
宜租网络不对因服务中断、延迟、错误等给用户造成的损失承担责任。
用户使用服务时，应自行承担风险。
8. 争议解决

因本协议引起的争议，双方应友好协商解决；协商不成的，任何一方均可向宜租网络所在地人民法院提起诉讼。

9. 法律适用

本协议受中国法律管辖。

10. 生效日期

本服务协议自用户点击“同意”按钮或使用服务之日起生效。

11. 其他

本协议的标题仅为方便阅读，不具有法律效力。
本协议的任何条款无效，不影响其他条款的效力。`;
});

async function handleSubmit() {
  try {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = await formApi.getValues();

    // 处理记住用户名功能
    try {
      localStorage.setItem(
        REMEMBER_ME_KEY,
        rememberMe.value ? values?.username || '' : '',
      );
    } catch (error) {
      console.warn('Failed to save remember me setting:', error);
    }

    emit('submit', values);
  } catch (error) {
    console.error('Form submission error:', error);
  }
}

function handleGo(path: string) {
  router.push(path);
}

function showPrivacyPolicy() {
  showPrivacyModal.value = true;
}

function closePrivacyModal() {
  showPrivacyModal.value = false;
}

function showServiceAgreement() {
  showServiceAgreementModal.value = true;
}

function closeServiceAgreementModal() {
  showServiceAgreementModal.value = false;
}

onMounted(() => {
  // 初始化记住用户名功能
  const savedUsername = localUsername.value;
  if (savedUsername) {
    formApi.setFieldValue('username', savedUsername);
    rememberMe.value = true;
  }
});

defineExpose({
  getFormApi: () => formApi,
});
</script>

<template>
  <div @keydown.enter.prevent="handleSubmit">
    <slot name="title">
      <Title>
        <slot name="title">
          {{ title || `${$t('authentication.welcomeBack')} 👋🏻` }}
        </slot>
        <template #desc>
          <span class="text-muted-foreground">
            <slot name="subTitle">
              {{ subTitle || $t('authentication.loginSubtitle') }}
            </slot>
          </span>
        </template>
      </Title>
    </slot>

    <Form />

    <div
      v-if="showRememberMe || showForgetPassword"
      class="mb-6 flex justify-between"
    >
      <div class="flex items-center space-x-4">
        <VbenCheckbox
          v-if="showRememberMe"
          v-model:checked="rememberMe"
          name="rememberMe"
        >
          {{ $t('authentication.rememberMe') }}
        </VbenCheckbox>
        <span
          class="vben-link cursor-pointer text-sm font-normal"
          tabindex="0"
          @click="showServiceAgreement"
          @keydown.enter="showServiceAgreement"
          @keydown.space.prevent="showServiceAgreement"
        >
          {{ $t('服务协议') }}
        </span>
        <span
          class="vben-link cursor-pointer pl-4 text-sm font-normal"
          tabindex="0"
          @click="showPrivacyPolicy"
          @keydown.enter="showPrivacyPolicy"
          @keydown.space.prevent="showPrivacyPolicy"
        >
          {{ $t('authentication.privacyPolicy', '隐私政策') }}
        </span>
      </div>

      <span
        v-if="showForgetPassword"
        class="vben-link text-sm font-normal"
        @click="handleGo(forgetPasswordPath)"
      >
        {{ $t('authentication.forgetPassword') }}
      </span>
    </div>
    <VbenButton
      :class="{
        'cursor-wait': loading,
      }"
      :loading="loading"
      aria-label="login"
      class="w-full"
      @click="handleSubmit"
    >
      {{ submitButtonText || $t('common.login') }}
    </VbenButton>

    <div
      v-if="showCodeLogin || showQrcodeLogin"
      class="mb-2 mt-4 flex items-center justify-between"
    >
      <VbenButton
        v-if="showCodeLogin"
        class="w-full"
        variant="outline"
        @click="handleGo(codeLoginPath)"
      >
        {{ $t('authentication.mobileLogin') }}
      </VbenButton>
    </div>

    <!-- 第三方登录 -->
    <!-- <slot name="third-party-login">
      <ThirdPartyLogin v-if="showThirdPartyLogin" />
    </slot>

    <slot name="to-register">
      <div v-if="showRegister" class="mt-3 text-center text-sm">
        {{ $t('authentication.accountTip') }}
        <span
          class="vben-link text-sm font-normal"
          @click="handleGo(registerPath)"
        >
          {{ $t('authentication.createAccount') }}
        </span>
      </div>
    </slot> -->

    <!-- 隐私政策弹窗 -->
    <VbenModal
      v-model:open="showPrivacyModal"
      :title="$t('authentication.privacyPolicy', '隐私协议')"
      class="mobile-small-modal"
      :class="PRIVACY_POLICY_MODAL_MAX_WIDTH"
      :bordered="true"
      :centered="true"
      header-class="bg-card text-foreground px-5 py-3"
      content-class="bg-card text-foreground p-4 no-scrollbar"
      :closable="false"
      @close="closePrivacyModal"
    >
      <div class="p-4" :class="[PRIVACY_POLICY_MODAL_MAX_HEIGHT]">
        <pre
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ privacyPolicyContent }}
        </pre>
      </div>
      <template #footer>
        <VbenButton variant="outline" @click="closePrivacyModal">
          {{ $t('关闭') }}
        </VbenButton>
      </template>
    </VbenModal>

    <!-- 服务协议弹窗 -->
    <VbenModal
      v-model:open="showServiceAgreementModal"
      :title="$t('服务协议')"
      class="mobile-small-modal"
      :class="PRIVACY_POLICY_MODAL_MAX_WIDTH"
      :bordered="true"
      :centered="true"
      header-class="bg-card text-foreground px-5 py-3"
      content-class="bg-card text-foreground p-4 no-scrollbar"
      :closable="false"
      @close="closeServiceAgreementModal"
    >
      <div class="p-4" :class="[PRIVACY_POLICY_MODAL_MAX_HEIGHT]">
        <pre
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ serviceAgreementContent }}
        </pre>
      </div>
      <template #footer>
        <VbenButton variant="outline" @click="closeServiceAgreementModal">
          {{ $t('关闭') }}
        </VbenButton>
      </template>
    </VbenModal>

    <!-- ICP 备案信息 -->
    <div
      v-if="preferences.copyright.enable && preferences.copyright.icp"
      class="mt-8 flex flex-col items-center justify-center pb-6 text-xs text-gray-400"
    >
      <a
        :href="preferences.copyright.icpLink || 'https://beian.miit.gov.cn/'"
        class="hover:text-primary mb-1 text-gray-400 no-underline"
        target="_blank"
      >
        {{ preferences.copyright.icp }}
      </a>
      <div>
        Copyright © {{ preferences.copyright.date }}
        {{ preferences.copyright.companyName }}
      </div>
    </div>
  </div>
</template>

<style>
@media (max-width: 768px) {
  .mobile-small-modal {
    inset: 0 !important;
    width: 92vw !important;
    max-width: 480px !important;
    height: auto !important;
    max-height: 75vh !important;
    margin: auto !important;
    color: hsl(var(--card-foreground));
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
    transform: none !important;
  }
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
