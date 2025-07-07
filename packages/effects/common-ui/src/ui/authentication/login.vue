<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '@vben-core/form-ui';

import type { AuthenticationProps } from './types';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm } from '@vben-core/form-ui';
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
  return `隐私政策

1. 引言

感谢您选择使用东莞市宜租网络科技有限公司（以下简称"宜租网络"或"我们"）提供的园区管理软件服务（以下简称"服务"）。我们的公司域名为 yizuw.cn。我们深知个人信息保护的重要性，并致力于保护访问或使用我们服务的用户的隐私。本隐私政策旨在说明我们如何收集、使用、存储和保护您的个人信息。

2. 信息收集

当您使用我们的服务时，我们可能收集以下信息：

个人和账户数据：包括姓名、联系方式、电子邮件地址、登录凭证等。
园区管理数据：包括园区设施使用情况、用户活动记录、安全监控数据等。
技术数据：包括IP地址、浏览器类型、设备信息、访问时间等。
通讯信息：包括您与我们客户服务团队的交流记录。

3. 信息使用

我们收集的信息将用于以下目的：

提供和改进我们的服务。
管理和运营园区，确保安全和效率。
与您沟通服务相关的信息。
遵守法律法规要求。

4. 数据共享与披露

我们不会出售或非法共享您的个人信息。但在以下情况下，我们可能需要共享您的信息：

遵循法律法规或政府机关的要求。
为了保护我们的合法权益。
在您同意的情况下。

5. 第三方服务

我们可能使用以下第三方服务来帮助我们提供和改进服务：

托管服务提供商：如阿里云、腾讯云等，用于存储和管理数据。
分析服务提供商：如百度统计、Google Analytics等，用于分析用户行为。
支付服务提供商：如支付宝、微信支付等，用于处理支付交易。

6. Cookie 和追踪

我们使用 Cookie 来优化用户体验和网站性能。您可以通过浏览器设置来管理 Cookie。

7. 数据保留

我们将根据法律法规和业务需要保留您的信息，通常包括：

账户数据：直到您的账户被注销。
交易数据：根据相关法律法规要求保留。
日志数据：通常保留1年。

8. 您的权利

根据适用的法律法规，您可能享有以下权利：

访问您的个人信息。
更正不准确的信息。
删除您的个人信息。
撤回同意。
提出反对。

9. 儿童隐私

我们不会故意收集13岁以下儿童的个人信息。如果发现此类情况，我们将立即采取措施删除相关信息。

10. 安全

我们采取适当的技术和安全措施来保护您的个人信息免受未经授权的访问、披露、篡改或破坏。

11. 政策变化

我们可能随时更新本隐私政策。重大变更将在我们的服务中通知您。

12. 联系我们

如果您对隐私政策有任何疑问或关切，请通过以下方式联系我们：

东莞市宜租网络科技有限公司
电子邮箱：jojoconnection@163.com

13. 法律适用

本隐私政策受中国法律管辖。

生效日期

本隐私政策生效日期：2025年7月1日

版权所有

© 2025 东莞市宜租网络科技有限公司 保留所有权利。
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
          {{ $t('authentication.serviceAgreement', '服务协议') }}
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

    <!-- <div
      v-if="showCodeLogin || showQrcodeLogin"
      class="mb-2 mt-4 flex items-center justify-between"
    >
      <VbenButton
        v-if="showCodeLogin"
        class="w-1/2"
        variant="outline"
        @click="handleGo(codeLoginPath)"
      >
        {{ $t('authentication.mobileLogin') }}
      </VbenButton>
      <VbenButton
        v-if="showQrcodeLogin"
        class="ml-4 w-1/2"
        variant="outline"
        @click="handleGo(qrCodeLoginPath)"
      >
        {{ $t('authentication.qrcodeLogin') }}
      </VbenButton>
    </div> -->

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
      :title="$t('authentication.privacyPolicy', '隐私政策')"
      :class="PRIVACY_POLICY_MODAL_MAX_WIDTH"
      @close="closePrivacyModal"
    >
      <div
        class="overflow-y-auto p-4"
        :class="[PRIVACY_POLICY_MODAL_MAX_HEIGHT]"
      >
        <pre
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ privacyPolicyContent }}
        </pre>
      </div>
      <template #footer>
        <VbenButton variant="outline" @click="closePrivacyModal">
          {{ $t('common.close', '关闭') }}
        </VbenButton>
      </template>
    </VbenModal>

    <!-- 服务协议弹窗 -->
    <VbenModal
      v-model:open="showServiceAgreementModal"
      :title="$t('authentication.serviceAgreement', '服务协议')"
      :class="PRIVACY_POLICY_MODAL_MAX_WIDTH"
      @close="closeServiceAgreementModal"
    >
      <div
        class="overflow-y-auto p-4"
        :class="[PRIVACY_POLICY_MODAL_MAX_HEIGHT]"
      >
        <pre
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ serviceAgreementContent }}
        </pre>
      </div>
      <template #footer>
        <VbenButton variant="outline" @click="closeServiceAgreementModal">
          {{ $t('common.close', '关闭') }}
        </VbenButton>
      </template>
    </VbenModal>
  </div>
</template>
