<script lang="ts" setup>
import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';
import { ChevronRight, LogOut, UserRoundPen } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Avatar, Card, List, ListItem, message, Modal } from 'ant-design-vue';

import { useAuthStore } from '#/store';

const userStore = useUserStore();
const authStore = useAuthStore();

const userInfo = computed(() => userStore.userInfo);

function handleLogout() {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: '您确定要退出登录吗？',
    okText: '确认',
    onOk: async () => {
      await authStore.logout(false);
      message.success('已退出登录');
    },
    title: '温馨提示',
  });
}

function handleEditProfile() {
  message.info('该功能正在开发中...');
}

const actions = [
  {
    handler: handleEditProfile,
    icon: UserRoundPen,
    title: '修改个人信息',
  },
  {
    handler: handleLogout,
    icon: LogOut,
    title: '退出登录',
  },
];
</script>

<template>
  <div class="p-3">
    <Card :bordered="false" class="mb-3">
      <div class="flex flex-col items-center justify-center py-4">
        <Avatar :size="64" :src="userInfo?.avatar" />
        <div class="mt-3 text-lg font-semibold">
          {{ userInfo?.realName }}
        </div>
      </div>
    </Card>

    <Card :bordered="false">
      <List :data-source="actions">
        <template #renderItem="{ item }">
          <ListItem @click="item.handler">
            <div class="flex w-full items-center justify-between">
              <div class="flex items-center">
                <VbenIcon :icon="item.icon" class="mr-2" />
                <span>{{ item.title }}</span>
              </div>
              <VbenIcon :icon="ChevronRight" />
            </div>
          </ListItem>
        </template>
      </List>
    </Card>
  </div>
</template>
