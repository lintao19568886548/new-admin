<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption, Recordable } from '@vben/types';

import { computed, markRaw, useTemplateRef } from 'vue';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';

import { usePlatform } from '#/hooks/usePlatform';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

// 使用 usePlatform Hook 获取平台信息
const { isNativePlatform } = usePlatform();

const authStore = useAuthStore();

function tText(key: string, fallback: string) {
  const text = $t(key);
  return text && text !== key ? text : fallback;
}

const MOCK_USER_OPTIONS: BasicOption[] = [
  {
    label: 'Super',
    value: 'vben',
  },
  {
    label: 'Admin',
    value: 'admin',
  },
  {
    label: 'User',
    value: 'jack',
  },
];

const formSchema = computed((): VbenFormSchema[] => {
  return [
    // {
    //   component: 'VbenSelect',
    //   // componentProps(_values, form) {
    //   //   return {
    //   //     'onUpdate:modelValue': (value: string) => {
    //   //       const findItem = MOCK_USER_OPTIONS.find(
    //   //         (item) => item.value === value,
    //   //       );
    //   //       if (findItem) {
    //   //         form.setValues({
    //   //           password: '123456',
    //   //           username: findItem.label,
    //   //         });
    //   //       }
    //   //     },
    //   //     options: MOCK_USER_OPTIONS,
    //   //     placeholder: $t('authentication.selectAccount'),
    //   //   };
    //   // },
    //   componentProps: {
    //     options: MOCK_USER_OPTIONS,
    //     placeholder: $t('authentication.selectAccount'),
    //   },
    //   fieldName: 'selectAccount',
    //   label: $t('authentication.selectAccount'),
    //   rules: z
    //     .string()
    //     .min(1, { message: $t('authentication.selectAccount') })
    //     .optional()
    //     .default('vben'),
    // },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: tText('authentication.usernameTip', '请输入用户名'),
      },
      dependencies: {
        trigger(values, form) {
          if (values.selectAccount) {
            const findUser = MOCK_USER_OPTIONS.find(
              (item) => item.value === values.selectAccount,
            );
            if (findUser) {
              form.setValues({
                password: '123456',
                username: findUser.value,
              });
            }
          }
        },
        triggerFields: ['selectAccount'],
      },
      fieldName: 'username',
      label: tText('authentication.username', '账号'),
      rules: z.string().min(1, {
        message: tText('authentication.usernameTip', '请输入用户名'),
      }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: tText('authentication.password', '密码'),
      },
      fieldName: 'password',
      label: tText('authentication.password', '密码'),
      rules: z.string().min(1, {
        message: tText('authentication.passwordTip', '请输入密码'),
      }),
    },
    {
      component: markRaw(SliderCaptcha),
      componentProps: {
        successText: tText('ui.captcha.sliderSuccessText', '验证通过'),
        text: tText('ui.captcha.sliderDefaultText', '请按住滑块拖动'),
      },
      fieldName: 'captcha',
      rules: z.boolean().refine((value) => value, {
        message: tText('authentication.verifyRequiredTip', '请先完成验证'),
      }),
    },
  ];
});

const loginRef =
  useTemplateRef<InstanceType<typeof AuthenticationLogin>>('loginRef');

async function onSubmit(params: Recordable<any>) {
  authStore.authLogin(params).catch(() => {
    // 登陆失败，刷新验证码的演示

    // 使用表单API获取验证码组件实例，并调用其resume方法来重置验证码
    loginRef.value
      ?.getFormApi()
      ?.getFieldComponentRef<InstanceType<typeof SliderCaptcha>>('captcha')
      ?.resume();
  });
}
</script>

<!-- eslint-disable vue/no-multiple-template-root -->
<template>
  <!-- Web Platform Login -->
  <AuthenticationLogin
    ref="loginRef"
    v-if="!isNativePlatform"
    :agree-and-continue-text="
      tText('authentication.agreeAndContinue', '同意并继续')
    "
    :agree-text="tText('authentication.agree', '我同意')"
    :agreement-required-message="
      tText('authentication.agreementRequiredMessage', '登录前请先阅读并同意')
    "
    :agreement-required-title="
      tText('authentication.agreementRequired', '温馨提示')
    "
    :and-text="tText('common.and', '和')"
    :cancel-text="tText('common.cancel', '取消')"
    :close-text="tText('common.close', '关闭')"
    :form-schema="formSchema"
    :forget-password-text="tText('authentication.forgetPassword', '忘记密码?')"
    :loading="authStore.loginLoading"
    :mobile-login-text="tText('authentication.mobileLogin', '手机号登录')"
    :privacy-policy-text="tText('authentication.privacyPolicy', '隐私协议')"
    :remember-me-text="tText('authentication.rememberMe', '记住账号')"
    :service-agreement-text="
      tText('authentication.serviceAgreement', '服务协议')
    "
    :submit-button-text="tText('common.login', '登录')"
    :sub-title="
      tText(
        'authentication.loginSubtitle',
        '请输入您的帐户信息以开始管理您的项目',
      )
    "
    :title="`${tText('authentication.welcomeBack', '欢迎回来')} 👋🏻`"
    @submit="onSubmit"
  />

  <!-- Native Platform Login with Safe Area -->
  <div v-else class="h-full">
    <div class="page-safe-area-container">
      <AuthenticationLogin
        ref="loginRef"
        :agree-and-continue-text="
          tText('authentication.agreeAndContinue', '同意并继续')
        "
        :agree-text="tText('authentication.agree', '我同意')"
        :agreement-required-message="
          tText(
            'authentication.agreementRequiredMessage',
            '登录前请先阅读并同意',
          )
        "
        :agreement-required-title="
          tText('authentication.agreementRequired', '温馨提示')
        "
        :and-text="tText('common.and', '和')"
        :cancel-text="tText('common.cancel', '取消')"
        :close-text="tText('common.close', '关闭')"
        :form-schema="formSchema"
        :forget-password-text="
          tText('authentication.forgetPassword', '忘记密码?')
        "
        :loading="authStore.loginLoading"
        :mobile-login-text="tText('authentication.mobileLogin', '手机号登录')"
        :privacy-policy-text="tText('authentication.privacyPolicy', '隐私协议')"
        :remember-me-text="tText('authentication.rememberMe', '记住账号')"
        :service-agreement-text="
          tText('authentication.serviceAgreement', '服务协议')
        "
        :submit-button-text="tText('common.login', '登录')"
        :sub-title="
          tText(
            'authentication.loginSubtitle',
            '请输入您的帐户信息以开始管理您的项目',
          )
        "
        :title="`${tText('authentication.welcomeBack', '欢迎回来')} 👋🏻`"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>

<style scoped>
.page-safe-area-container {
  /* 确保容器是块级元素并且其内边距不会导致溢出或尺寸计算问题 */

  /* Ensure the container is a block-level element and its padding doesn't cause overflow or size calculation issues */
  box-sizing: border-box;

  /* 让容器至少占据整个视口的高度，宽度默认为100% */

  /* Make the container take at least the full viewport height, width defaults to 100% */
  width: 100%;
  min-height: auto; /* 或者使用 100% 如果父元素已设定高度 */

  /* 顶部安全区由认证布局统一处理，这里只保留左右与底部 */
  padding: 0 var(--app-safe-area-right, env(safe-area-inset-right, 0))
    var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0))
    var(--app-safe-area-left, env(safe-area-inset-left, 0));

  /* 可选：如果需要内容垂直居中或有特定布局需求 */

  /* Optional: if content needs to be vertically centered or for specific layout needs */

  /* display: flex; */

  /* flex-direction: column; */

  /* align-items: center; */

  /* justify-content: center; */
}
</style>
