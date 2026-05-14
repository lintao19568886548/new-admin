<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Space,
  Switch,
  Tag,
} from 'ant-design-vue';

defineOptions({ name: 'SystemRadarConfig' });

interface RadarConfigState {
  allowAutoSync: boolean;
  allowedSources: string[];
  crawlCities: string;
  crawlPageLimit: number;
  enableDemandCollection: boolean;
  enableSupplyCollection: boolean;
  highPriorityThreshold: number;
  keywordBlacklist: string;
  keywordWhitelist: string;
  minAreaSqm: number;
  syncIntervalMinutes: number;
}

const STORAGE_KEY = 'radar-config-v1';

const defaultState: RadarConfigState = {
  allowAutoSync: true,
  allowedSources: ['99cfw', '58', 'ganji'],
  crawlCities: '惠州, 东莞, 深圳',
  crawlPageLimit: 10,
  enableDemandCollection: true,
  enableSupplyCollection: true,
  highPriorityThreshold: 85,
  minAreaSqm: 300,
  syncIntervalMinutes: 60,
  keywordBlacklist: '中介, 转租',
  keywordWhitelist: '厂房, 仓库, 产业园',
};

const sourceOptions = [
  { label: '99厂房网', value: '99cfw' },
  { label: '58同城', value: '58' },
  { label: '赶集网', value: 'ganji' },
  { label: '百姓网', value: 'baixing' },
  { label: '本地招商群', value: 'manual' },
];

const router = useRouter();
const saving = ref(false);
const state = ref<RadarConfigState>(loadState());

const selectedSourceLabels = computed(() =>
  sourceOptions
    .filter((item) => state.value.allowedSources.includes(item.value))
    .map((item) => item.label),
);

watch(
  state,
  (value) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  },
  { deep: true },
);

function loadState(): RadarConfigState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...defaultState };
  }

  try {
    return {
      ...defaultState,
      ...(JSON.parse(raw) as Partial<RadarConfigState>),
    };
  } catch {
    return { ...defaultState };
  }
}

function resetState() {
  state.value = { ...defaultState };
  message.success('已恢复默认雷达配置');
}

function saveState() {
  saving.value = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
    message.success('雷达配置已保存');
  } finally {
    saving.value = false;
  }
}

function goToRadarList() {
  router.push('/investment/radar');
}
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">雷达配置</div>
          <div class="text-text-secondary text-sm">
            配置招商雷达的数据来源、同步频率与线索筛选规则。
          </div>
        </div>
        <Space>
          <Button @click="goToRadarList">返回雷达列表</Button>
          <Button @click="resetState">恢复默认</Button>
          <Button type="primary" :loading="saving" @click="saveState">
            保存设置
          </Button>
        </Space>
      </div>

      <Row :gutter="[16, 16]">
        <Col :lg="8" :md="12" :sm="24" :xs="24">
          <Card>
            <div class="text-text-secondary text-sm">自动同步</div>
            <div class="mt-2 text-2xl font-semibold">
              {{ state.allowAutoSync ? '已启用' : '未启用' }}
            </div>
          </Card>
        </Col>
        <Col :lg="8" :md="12" :sm="24" :xs="24">
          <Card>
            <div class="text-text-secondary text-sm">同步间隔</div>
            <div class="mt-2 text-2xl font-semibold">
              {{ state.syncIntervalMinutes }} 分钟
            </div>
          </Card>
        </Col>
        <Col :lg="8" :md="24" :sm="24" :xs="24">
          <Card>
            <div class="text-text-secondary text-sm">启用来源数</div>
            <div class="mt-2 text-2xl font-semibold">
              {{ selectedSourceLabels.length }}
            </div>
          </Card>
        </Col>
      </Row>

      <Row :gutter="[16, 16]">
        <Col :lg="12" :md="24" :sm="24" :xs="24">
          <Card title="采集策略">
            <Form layout="vertical">
              <Form.Item label="启用自动同步">
                <Switch v-model:checked="state.allowAutoSync" />
              </Form.Item>
              <Form.Item label="同步间隔（分钟）">
                <InputNumber
                  v-model:value="state.syncIntervalMinutes"
                  :min="5"
                  :step="5"
                  class="w-full"
                />
              </Form.Item>
              <Form.Item label="采集页数上限">
                <InputNumber
                  v-model:value="state.crawlPageLimit"
                  :min="1"
                  :max="100"
                  class="w-full"
                />
              </Form.Item>
              <Form.Item label="采集城市">
                <Input.TextArea
                  v-model:value="state.crawlCities"
                  :auto-size="{ minRows: 3, maxRows: 5 }"
                  placeholder="多个城市用逗号分隔"
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col :lg="12" :md="24" :sm="24" :xs="24">
          <Card title="机会规则">
            <Form layout="vertical">
              <Form.Item label="启用公开房源采集">
                <Switch v-model:checked="state.enableSupplyCollection" />
              </Form.Item>
              <Form.Item label="启用公开需求采集">
                <Switch v-model:checked="state.enableDemandCollection" />
              </Form.Item>
              <Form.Item label="高优先级阈值">
                <InputNumber
                  v-model:value="state.highPriorityThreshold"
                  :min="0"
                  :max="100"
                  class="w-full"
                />
              </Form.Item>
              <Form.Item label="最小面积阈值（㎡）">
                <InputNumber
                  v-model:value="state.minAreaSqm"
                  :min="0"
                  :step="50"
                  class="w-full"
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      <Row :gutter="[16, 16]">
        <Col :lg="12" :md="24" :sm="24" :xs="24">
          <Card title="来源管理">
            <Form layout="vertical">
              <Form.Item label="启用来源">
                <Checkbox.Group
                  v-model:value="state.allowedSources"
                  :options="sourceOptions"
                />
              </Form.Item>
              <Form.Item label="已启用来源">
                <Space wrap>
                  <Tag
                    v-for="label in selectedSourceLabels"
                    :key="label"
                    color="blue"
                  >
                    {{ label }}
                  </Tag>
                  <span v-if="selectedSourceLabels.length === 0">暂无</span>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col :lg="12" :md="24" :sm="24" :xs="24">
          <Card title="关键词规则">
            <Form layout="vertical">
              <Form.Item label="白名单关键词">
                <Input.TextArea
                  v-model:value="state.keywordWhitelist"
                  :auto-size="{ minRows: 3, maxRows: 5 }"
                  placeholder="多个关键词用逗号分隔"
                />
              </Form.Item>
              <Form.Item label="黑名单关键词">
                <Input.TextArea
                  v-model:value="state.keywordBlacklist"
                  :auto-size="{ minRows: 3, maxRows: 5 }"
                  placeholder="多个关键词用逗号分隔"
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  </Page>
</template>
