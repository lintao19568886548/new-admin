<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { onMounted, ref, watch } from 'vue';

import { ColPage } from '@vben/common-ui';

import { Card, Empty, Input, message, Tree } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getYmsinoElectricData, getYmsinoElectricTree } from '#/api/ymsino';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';

const searchKeyword = ref('');
const treeLoading = ref(false);
const expandedKeys = ref<string[]>([]);
const selectedKeys = ref<string[]>([]);
const treeData = ref<any[]>([]);
const selectedComAddress = ref<string | undefined>(undefined);
const selectedParentKey = ref<string | undefined>(undefined);

const findNodeByKey = (list: any[], key: string) => {
  const stack = Array.isArray(list) ? [...list] : [];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) continue;
    if (String(n.key) === String(key)) return n;
    if (Array.isArray(n.children)) stack.push(...n.children);
  }
  return null;
};

const collectLeafAddresses = (node: any): string[] => {
  const out: string[] = [];
  const stack = [node];
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
};

async function fetchTree(kw?: string) {
  try {
    treeLoading.value = true;
    const nodes = await getYmsinoElectricTree(kw ? { keyword: kw } : undefined);
    treeData.value = nodes;
    const keys: string[] = [];
    const stack = Array.isArray(nodes) ? [...nodes] : [];
    while (stack.length > 0) {
      const n = stack.pop();
      if (!n) continue;
      if (n.key) keys.push(String(n.key));
      if (Array.isArray(n.children) && n.children.length > 0) {
        stack.push(...n.children);
      }
    }
    expandedKeys.value = keys;
  } catch {
    message.error('加载建筑列表失败');
  } finally {
    treeLoading.value = false;
  }
}

function onSelect(keys: any, info: any) {
  selectedKeys.value = (keys as string[]) || [];
  const node = info?.node;
  if (!node) return;

  if (node?.isLeaf === true) {
    selectedComAddress.value = node?.dataRef?.comAddress as string | undefined;
    selectedParentKey.value = undefined;
  } else {
    selectedComAddress.value = undefined;
    selectedParentKey.value = String(node.key || '');
  }
  gridApi.query();
}

onMounted(async () => {
  await fetchTree();
  gridApi.query();
});

let searchTimer: any;
watch(
  () => searchKeyword.value,
  (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      fetchTree(String(val || '').trim());
    }, 300);
  },
);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: false,
    fieldMappingTime: [['freezeTime', ['timeFrom', 'timeTo']]],
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    border: true,
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (page) => {
          try {
            const formData = (await gridApi.formApi?.getValues?.()) || {};
            const type = Number(formData.type || 2);
            let timeFrom = formData.timeFrom;
            let timeTo = formData.timeTo;
            if (timeFrom && !String(timeFrom).includes(':'))
              timeFrom = `${timeFrom} 00:00:00`;
            if (timeTo && !String(timeTo).includes(':'))
              timeTo = `${timeTo} 23:59:59`;
            const effectiveComAddress =
              formData.comAddress || selectedComAddress.value || undefined;
            const effectiveComAddresses =
              !effectiveComAddress && selectedParentKey.value
                ? collectLeafAddresses(
                    findNodeByKey(treeData.value, selectedParentKey.value) ||
                      {},
                  )
                : undefined;
            const current = page.page?.currentPage || 1;
            const size = page.page?.pageSize || 20;
            const payload: any = {
              page: current,
              pageSize: size,
              timeFrom,
              timeTo,
              type,
            };
            if (effectiveComAddress) {
              payload.comAddress = effectiveComAddress;
            } else if (
              effectiveComAddresses &&
              effectiveComAddresses.length > 0
            ) {
              payload.comAddress = effectiveComAddresses.join(',');
            }
            const resp = await getYmsinoElectricData(payload);
            let items: any[] = (resp as any)?.items ?? (resp as any);
            items = Array.isArray(items) ? items : [];
            const nameMap: Record<string, string> = {};
            {
              const stack = Array.isArray(treeData.value)
                ? [...treeData.value]
                : [];
              while (stack.length > 0) {
                const n = stack.pop();
                if (!n) continue;
                if (n.isLeaf === true && n?.dataRef?.comAddress) {
                  const addr = String(n.dataRef.comAddress);
                  const nm = String(n?.dataRef?.piplineName ?? n?.title ?? '');
                  if (addr && nm) nameMap[addr] = nm;
                }
                if (Array.isArray(n.children) && n.children.length > 0) {
                  stack.push(...n.children);
                }
              }
            }
            items = items.map((it) => {
              const addr = String(it?.comAddress ?? '');
              const pipName = nameMap[addr];
              return pipName ? { ...it, piplineName: pipName } : it;
            });
            const total = Number((resp?.total as any) ?? items.length);
            return { total, items } as any;
          } catch {
            message.error('获取列表失败');
            return { page: { total: 0 }, result: [] } as any;
          }
        },
      },
      autoLoad: false,
    },
    rowConfig: {
      keyField: 'comAddress',
    },
    scrollX: { enabled: true },
    scrollY: { enabled: true },
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<any>,
});
</script>
<template>
  <ColPage
    auto-content-height
    :left-width="14"
    :right-width="84"
    left-collapsible
    :left-collapsed-width="6"
  >
    <template #left>
      <Card
        class="meter-left-card"
        :body-style="{ padding: '8px' }"
        :bordered="false"
        title="建筑列表"
        style="height: 100%"
      >
        <div class="meter-left">
          <div class="meter-left-search">
            <Input
              v-model:value="searchKeyword"
              placeholder="请输入建筑名"
              allow-clear
            />
          </div>
          <div class="meter-left-tree">
            <Tree
              :tree-data="treeData"
              :expanded-keys="expandedKeys"
              :selected-keys="selectedKeys"
              :show-line="true"
              :block-node="true"
              :default-expand-all="true"
              :loading="treeLoading"
              @select="onSelect"
            />
            <Empty
              v-if="!treeLoading && treeData.length === 0"
              description="暂无数据"
            />
          </div>
        </div>
      </Card>
    </template>
    <Grid :table-title="$t('电表抄表数据')" />
  </ColPage>
</template>

<style scoped>
.meter-left-card {
  margin: 0 8px;
}

.meter-left {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.meter-left-search {
  padding: 8px;
}

.meter-left-tree {
  flex: 1;
  padding: 0 8px 8px;
  overflow: auto;
}
</style>
