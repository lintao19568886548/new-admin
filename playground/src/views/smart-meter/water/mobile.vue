<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { onMounted, reactive, ref } from 'vue';

import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  message,
  Pagination,
  Row,
  Select,
  Spin,
  Tag,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getWaterData, getWaterTree } from '#/api/hezhong';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';

const freezeRange = ref<[Dayjs, Dayjs]>([dayjs(), dayjs()]);

const searchForm = reactive<{ comAddress: string; type: number }>({
  comAddress: '',
  type: 2,
});

const loading = ref(false);
const list = ref<any[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const nameMap = ref<Record<string, string>>({});
const treeLoading = ref(false);
const buildingTreeData = ref<any[]>([]);
const selectedBuildingValue = ref<string | undefined>(undefined);
const waterTreeRaw = ref<any[]>([]);

async function fetchTreeNameMap() {
  try {
    treeLoading.value = true;
    const nodes: any[] = await getWaterTree();
    waterTreeRaw.value = nodes || [];
    const map: Record<string, string> = {};
    const stack = Array.isArray(nodes) ? [...nodes] : [];
    while (stack.length > 0) {
      const n = stack.pop();
      if (!n) continue;
      if (n.isLeaf === true && n?.dataRef?.comAddress) {
        const addr = String(n.dataRef.comAddress);
        const nm = String(n?.dataRef?.piplineName ?? n?.title ?? '');
        if (addr && nm) map[addr] = nm;
      }
      if (Array.isArray(n.children) && n.children.length > 0) {
        stack.push(...n.children);
      }
    }
    nameMap.value = map;
    buildingTreeData.value = convertToTreeSelect(nodes || []);
  } catch {
    message.error('加载建筑列表失败');
  } finally {
    treeLoading.value = false;
  }
}

function convertToTreeSelect(nodes: any[]): any[] {
  return (nodes || []).map((n: any) => ({
    title: String(n?.title ?? ''),
    value:
      n?.isLeaf === true && n?.dataRef?.comAddress
        ? String(n.dataRef.comAddress)
        : String(n?.key ?? ''),
    children: Array.isArray(n?.children)
      ? convertToTreeSelect(n.children)
      : undefined,
  }));
}

function findNodeByValue(value?: string) {
  if (!value) return null;
  const stack = Array.isArray(waterTreeRaw.value)
    ? [...waterTreeRaw.value]
    : [];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) continue;
    const isLeaf = n.isLeaf === true && n?.dataRef?.comAddress;
    if (isLeaf) {
      if (String(n.dataRef.comAddress) === String(value)) return n;
    } else if (String(n.key) === String(value)) {
      return n;
    }
    if (Array.isArray(n.children) && n.children.length > 0)
      stack.push(...n.children);
  }
  return null;
}

function collectLeafAddresses(node: any): string[] {
  const out: string[] = [];
  const stack = node ? [node] : [];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) continue;
    if (n.isLeaf === true && n?.dataRef?.comAddress) {
      out.push(String(n.dataRef.comAddress));
    } else if (Array.isArray(n.children)) {
      stack.push(...n.children);
    }
  }
  return [...new Set(out)];
}

async function fetchList() {
  loading.value = true;
  try {
    const startDate = freezeRange.value?.[0]?.format('YYYY-MM-DD');
    const endDate = freezeRange.value?.[1]?.format('YYYY-MM-DD');
    const timeFrom = startDate ? `${startDate} 00:00:00` : undefined;
    const timeTo = endDate ? `${endDate} 23:59:59` : undefined;
    const payload: any = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      timeFrom,
      timeTo,
      type: Number(searchForm.type),
    };
    let effectiveComAddress: string | undefined;
    let effectiveComAddresses: string[] | undefined;
    if (searchForm.comAddress) {
      effectiveComAddress = searchForm.comAddress;
    } else if (selectedBuildingValue.value) {
      const node = findNodeByValue(selectedBuildingValue.value);
      if (node?.isLeaf === true && node?.dataRef?.comAddress) {
        effectiveComAddress = String(node.dataRef.comAddress);
      } else if (node) {
        effectiveComAddresses = collectLeafAddresses(node);
      }
    }
    if (effectiveComAddress) {
      payload.comAddress = effectiveComAddress;
    } else if (effectiveComAddresses && effectiveComAddresses.length > 0) {
      payload.comAddress = effectiveComAddresses.join(',');
    }
    const resp = await getWaterData(payload);
    let items: any[] = (resp as any)?.items ?? (resp as any);
    items = Array.isArray(items) ? items : [];
    items = items.map((it) => {
      const addr = String(it?.comAddress ?? '');
      const pipName = nameMap.value[addr];
      return pipName ? { ...it, piplineName: pipName } : it;
    });
    const total = Number((resp?.total as any) ?? items.length);
    list.value = items;
    pagination.total = total;
  } catch {
    console.error('获取列表失败');
    list.value = [];
    pagination.total = 0;
    message.error('获取列表失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.current = 1;
  fetchList();
}

function resetSearch() {
  freezeRange.value = [dayjs(), dayjs()];
  searchForm.comAddress = '';
  searchForm.type = 2;
  pagination.current = 1;
  fetchList();
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchList();
}

onMounted(async () => {
  await fetchTreeNameMap();
  await fetchList();
});

const typeOptions = [
  { label: '小时冻结数据', value: 1 },
  { label: '日冻结数据', value: 2 },
  { label: '月冻结数据', value: 3 },
];
</script>

<template>
  <div class="mobile-water-container">
    <div class="search-filters">
      <Form layout="vertical">
        <Row :gutter="16">
          <Col :span="24">
            <Form.Item label="冻结时间">
              <MobileDateRange v-model:value="freezeRange" />
            </Form.Item>
          </Col>
          <Col :span="24">
            <Form.Item label="建筑">
              <TreeSelect
                v-model:value="selectedBuildingValue"
                :tree-data="buildingTreeData"
                :tree-default-expand-all="true"
                :loading="treeLoading"
                placeholder="请选择建筑或设备"
                allow-clear
                style="width: 100%"
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="水表编号">
              <Input
                v-model:value="searchForm.comAddress"
                placeholder="请输入水表编号"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="数据类型">
              <Select
                v-model:value="searchForm.type"
                :options="typeOptions"
                placeholder="选择数据类型"
                allow-clear
              />
            </Form.Item>
          </Col>
        </Row>
        <div class="search-actions">
          <Button type="primary" @click="handleSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('搜索') }}
          </Button>
          <Button @click="resetSearch" class="flex-1">{{ $t('重置') }}</Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('加载中...')">
      <div v-if="list.length > 0" class="water-list">
        <Card
          v-for="item in list"
          :key="item.comAddress + String(item.freezeTime)"
          class="water-card"
          :body-style="{ padding: '0' }"
        >
          <div class="card-header">
            <span class="title">{{ item.piplineName || item.comAddress }}</span>
            <Tag>{{ item.dataItemName }}</Tag>
          </div>
          <div class="card-content">
            <div class="amount-display">
              <span class="amount-label">总用水量(吨)</span>
              <span class="amount">{{ item.dataValue }}</span>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">设备编号</span>
                <span class="info-value">{{ item.comAddress }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">冻结时间</span>
                <span class="info-value">{{
                  formatDateTime(item.freezeTime)
                }}</span>
              </div>
            </div>
          </div>
        </Card>
        <Pagination
          v-if="pagination.total > 0"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="handlePageChange"
          size="small"
          class="list-pagination"
        />
      </div>
      <Empty v-else :description="loading ? $t('加载中...') : $t('暂无数据')" />
    </Spin>
  </div>
</template>

<style scoped>
.mobile-water-container {
  box-sizing: border-box;
  padding: 8px;
  background-color: #f0f2f5;
}

.search-filters {
  padding: 12px 8px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.search-filters .ant-form-item {
  margin-bottom: 8px;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.water-list {
  padding-bottom: 10px;
}

.water-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

:deep(.water-card .ant-card-body) {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.title {
  margin-right: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.card-content {
  padding: 16px;
}

.amount-display {
  margin-bottom: 16px;
  text-align: center;
}

.amount-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #969799;
}

.amount {
  font-size: 24px;
  font-weight: 600;
  color: #1677ff;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  margin-bottom: 2px;
  font-size: 13px;
  color: #969799;
}

.info-value {
  font-size: 14px;
  color: #323233;
}

.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
}

.flex-1 {
  flex: 1;
}
</style>
