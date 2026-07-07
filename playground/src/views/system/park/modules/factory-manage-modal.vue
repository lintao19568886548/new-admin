<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';

import { Spin } from 'ant-design-vue';

import { getFactoryList } from '#/api/factory';
import { useParkStore } from '#/store';
import FactoryForm from '#/views/rental/manage/modules/factory-form.vue';

const store = useParkStore();
const router = useRouter();
const factories = ref<any[]>([]);
const parkName = ref('');
const loading = ref(false);
const autoCreateFactory = ref(false);
const setupFlow = ref(false);

async function loadFactories(parkId: number) {
  loading.value = true;
  try {
    const result = await getFactoryList({
      isOwn: 'true',
      pageSize: 100,
      parkId,
    });
    factories.value = result?.items ?? [];
  } catch {
    factories.value = [];
  } finally {
    loading.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: true,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<{
        autoCreate?: boolean;
        parkId: number;
        parkName: string;
        setupFlow?: boolean;
      }>();
      if (data?.parkId) {
        store.parkId = data.parkId;
        parkName.value = data.parkName ?? '';
        autoCreateFactory.value = data.autoCreate === true;
        setupFlow.value = data.setupFlow === true;
        loadFactories(data.parkId);
      }
    } else {
      factories.value = [];
      parkName.value = '';
      autoCreateFactory.value = false;
      setupFlow.value = false;
    }
  },
});

function onFactorySuccess(payload?: {
  action?: 'create' | 'update';
  setupFlow?: boolean;
}) {
  if (
    payload?.action !== 'create' ||
    (!payload.setupFlow && !setupFlow.value)
  ) {
    return;
  }

  modalApi.close();
  void router.push({
    path: '/system/user',
    query: {
      autoCreate: 'true',
      setupFlow: '1',
      tab: 'accounts',
    },
  });
}
</script>

<template>
  <Modal
    :footer="false"
    :title="`管理厂房 — ${parkName}`"
    class="factory-manage-modal"
  >
    <Spin :spinning="loading">
      <FactoryForm
        v-model="factories"
        :auto-create="autoCreateFactory"
        :setup-flow="setupFlow"
        @success="onFactorySuccess"
      />
    </Spin>
  </Modal>
</template>

<style scoped>
:deep(.factory-manage-modal) {
  min-width: 680px;
}
</style>
