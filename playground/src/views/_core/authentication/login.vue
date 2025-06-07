<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption, Recordable } from '@vben/types';

import { computed, markRaw, useTemplateRef } from 'vue';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { usePlatform } from '#/hooks/usePlatform';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

// 使用 usePlatform Hook 获取平台信息
const { isNativePlatform } = usePlatform();

const authStore = useAuthStore();

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
        placeholder: $t('authentication.usernameTip'),
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
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: markRaw(SliderCaptcha),
      fieldName: 'captcha',
      rules: z.boolean().refine((value) => value, {
        message: $t('authentication.verifyRequiredTip'),
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
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="onSubmit"
  />

  <!-- Native Platform Login with Safe Area -->
  <div v-else class="h-full">
    <div class="page-safe-area-container">
      <AuthenticationLogin
        ref="loginRef"
        :form-schema="formSchema"
        :loading="authStore.loginLoading"
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
  min-height: 100vh; /* 或者使用 100% 如果父元素已设定高度 */

  /* 使用 CSS 环境变量为容器的四边添加内边距 */

  /* Apply padding to the four sides of the container using CSS environment variables */
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);

  /* 可选：如果需要内容垂直居中或有特定布局需求 */

  /* Optional: if content needs to be vertically centered or for specific layout needs */

  /* display: flex; */

  /* flex-direction: column; */

  /* align-items: center; */

  /* justify-content: center; */
}
</style>
