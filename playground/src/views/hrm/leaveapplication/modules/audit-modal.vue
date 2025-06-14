<script lang="ts" setup>
import type { LeaveApplication } from '#/api/hrm/leaveapplication';

import { computed, ref, shallowRef } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Input as AInput,
  Radio as ARadio,
  message,
  Spin,
} from 'ant-design-vue';

import { updateLeaveApplication } from '#/api/hrm/leaveapplication';

const emit = defineEmits(['success']);

const record = ref<LeaveApplication | null>(null);
const loading = shallowRef(false);
const selectedStatus = ref<1 | 2 | null>(null);
const reply = ref('');

const getTitle = computed(() => {
  return `审批请假申请: ${record.value?.user || ''}`;
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (selectedStatus.value === null) {
      message.warning('请选择审批结果');
      return;
    }

    if (!record.value) {
      return;
    }

    const userStore = useUserStore();
    const realname = userStore.userInfo?.realName;

    if (!realname) {
      message.error('无法获取当前用户信息，请重新登录后再试');
      return;
    }

    const actionText = selectedStatus.value === 1 ? '通过' : '不通过';
    loading.value = true;
    modalApi.lock();
    try {
      await updateLeaveApplication(record.value.id, {
        auditUser: realname,
        reply: reply.value,
        status: selectedStatus.value,
      });
      message.success(`已成功${actionText}该申请`);
      emit('success');
      modalApi.close();
    } catch (error) {
      console.error(`审批操作失败:`, error);
      message.error(`操作失败`);
    } finally {
      loading.value = false;
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      record.value = modalApi.getData<LeaveApplication>();
      selectedStatus.value = null; // 重置选项
      reply.value = ''; // 重置审批意见
    } else {
      record.value = null;
    }
  },
});
</script>

<template>
  <Modal :title="getTitle">
    <Spin :spinning="loading">
      <div class="p-6 text-center">
        <p class="text-lg">
          请对
          <span class="text-primary font-semibold">{{ record?.user }}</span>
          的请假申请进行审批。
        </p>
        <div class="mt-8 flex justify-center">
          <ARadio.Group v-model:value="selectedStatus">
            <ARadio.Button :value="1">通过</ARadio.Button>
            <ARadio.Button :value="2">不通过</ARadio.Button>
          </ARadio.Group>
        </div>
        <div class="mt-6">
          <AInput.TextArea
            v-model:value="reply"
            :rows="3"
            placeholder="请输入审批意见（可选）"
          />
        </div>
      </div>
    </Spin>
  </Modal>
</template>
