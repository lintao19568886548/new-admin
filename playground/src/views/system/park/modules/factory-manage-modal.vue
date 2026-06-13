<script setup lang="ts">
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Spin } from 'ant-design-vue';

import { getFactoryList } from '#/api/factory';
import { useParkStore } from '#/store';
import FactoryForm from '#/views/rental/manage/modules/factory-form.vue';

const store = useParkStore();
const factories = ref<any[]>([]);
const parkName = ref('');
const loading = ref(false);

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
      const data = modalApi.getData<{ parkId: number; parkName: string }>();
      if (data?.parkId) {
        store.parkId = data.parkId;
        parkName.value = data.parkName ?? '';
        loadFactories(data.parkId);
      }
    } else {
      factories.value = [];
      parkName.value = '';
    }
  },
});
</script>

<template>
  <Modal
    :footer="false"
    :title="`管理厂房 — ${parkName}`"
    class="factory-manage-modal"
  >
    <Spin :spinning="loading">
      <FactoryForm v-model="factories" />
    </Spin>
  </Modal>
</template>

<style scoped>
:deep(.factory-manage-modal) {
  min-width: 680px;
}
</style>
