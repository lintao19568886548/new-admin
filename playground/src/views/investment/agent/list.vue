<script lang="ts" setup>
import type { InvestmentAgent } from './data'; // 导入 InvestmentAgent 接口

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { createApp, h, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { BulbOutlined, EnvironmentOutlined } from '@ant-design/icons-vue';
import { Button, Input, message, Modal, Space, Table } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteInvestment, getInvestmentList } from '#/api/investment';
import { getParkList } from '#/api/park';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const currentPark = ref();
const recommendModalVisible = ref(false);
const recommendLoading = ref(false);
const nearbyParks = ref<any[]>([]);
const manualLocationModalVisible = ref(false);
const manualAddress = ref('');
const parkNameMap = ref<Record<number, string>>({});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: InvestmentAgent) {
  const rowData = { ...row };
  rowData.meetingTime = String(formatDateTime(rowData.meetingTime));
  formModalApi.setData(rowData).open();
}

/**
 * 创建新租赁项目
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除租赁项目
 * @param row
 */
async function onDelete(row: InvestmentAgent) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.agentName || '']), // 使用 agentName 或其他合适字段
    duration: 0,
    key: 'action_process_msg',
  });

  const { investmentId } = row;
  if (investmentId) {
    try {
      await deleteInvestment(investmentId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']), // 使用 tenantName
        key: 'action_process_msg',
      });
      refreshGrid();
    } catch (error) {
      console.error('删除投资项目失败:', error); // 修正错误消息
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: InvestmentAgent) {
  let imgList: string[] = [];
  if (Array.isArray(row.imageUrlList)) {
    imgList = row.imageUrlList;
  } else if (row.imageUrlList) {
    imgList = [row.imageUrlList];
  }

  const previewContainer = document.createElement('div');
  document.body.append(previewContainer);

  const previewApp = createApp({
    setup() {
      const visible = ref(false);

      onUnmounted(() => {
        if (document.body.contains(previewContainer)) {
          previewContainer.remove();
        }
      });

      onMounted(() => {
        nextTick(() => {
          visible.value = true;
        });
      });

      return () =>
        h(
          'div',
          {
            preview: {
              onVisibleChange: (v: boolean) => {
                visible.value = v;
                if (!v) {
                  setTimeout(() => {
                    previewApp.unmount();
                  }, 200);
                }
              },
              visible: visible.value,
            },
          },
          imgList.map(
            (
              src: string, // 将 any 替换为 string
            ) =>
              h(Image as any, {
                preview: {},
                src,
                style: { display: 'none' },
              }),
          ),
        );
    },
  });

  previewApp.mount(previewContainer);
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<InvestmentAgent>) {
  // 使用 InvestmentAgent
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case '查看': {
      onView(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['meetingTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const formData = (await gridApi.formApi?.getValues?.()) || {};

          const params = {
            ...formData,
            currentPage: page.page?.currentPage || 1,
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            const result = await getInvestmentList(params);
            const items = Array.isArray(result?.items) ? result.items : [];
            const normalizedItems = items.map((item: any) => {
              const n = String(item?.parkName || '').trim();
              if (n) return item;
              const id = item?.parkId;
              if (typeof id === 'number') {
                return { ...item, parkName: parkNameMap.value[id] };
              }
              return item;
            });
            return {
              ...result,
              items: normalizedItems,
            };
          } catch (error) {
            console.error('获取投资项目列表失败:', error); // 修正错误消息
            message.error('获取投资项目列表失败'); // 修正错误消息
            return {
              page: {
                currentPage: 1,
                pageSize: 20,
                total: 0,
              },
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'investmentId', // 更新为 investmentId
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}

onMounted(() => {
  getParkList()
    .then((list: any[]) => {
      if (!Array.isArray(list)) return;
      parkNameMap.value = Object.fromEntries(
        list.map((p: any) => [Number(p.parkId), String(p.parkName)]),
      );
      refreshGrid();
    })
    .catch(() => {
      parkNameMap.value = {};
    });
});

/**
 * 获取当前地理位置
 */
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持地理位置服务'));
      return;
    }

    const options = {
      enableHighAccuracy: true, // 启用高精度定位
      maximumAge: 300_000, // 5分钟内的缓存位置可用
      timeout: 15_000, // 15秒超时
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position);
      },
      (error) => {
        reject(error);
      },
      options,
    );
  });
}

/**
 * 使用高德地图POI搜索附近工厂
 */
async function searchNearbyParks(longitude: number, latitude: number) {
  const key = import.meta.env.VITE_AMAP_KEY;
  if (!key || key === 'YOUR_AMAP_KEY_HERE') {
    throw new Error('请先配置高德地图API Key');
  }
  const url = `https://restapi.amap.com/v3/place/around?key=${key}&location=${longitude},${latitude}&keywords=工厂&types=170300&radius=5000&offset=50&page=1&extensions=all`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.pois) {
      return data.pois.map((poi: any) => ({
        address: poi.address,
        distance: poi.distance,
        id: poi.id,
        location: poi.location,
        name: poi.name,
        tel: poi.tel || '暂无电话',
        type: poi.type,
        typecode: poi.typecode,
      }));
    }
    return [];
  } catch (error) {
    console.error('搜索附近工厂失败:', error);
    throw error;
  }
}

/**
 * 智能推荐按钮点击事件
 */
async function onSmartRecommend() {
  try {
    recommendLoading.value = true;
    message.loading({
      content: '正在获取您的位置信息...',
      duration: 0,
      key: 'location_loading',
    });

    // 获取当前位置
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;

    message.loading({
      content: '正在搜索附近工厂...',
      duration: 0,
      key: 'location_loading',
    });

    // 搜索附近工厂
    const parks = await searchNearbyParks(longitude, latitude);

    message.destroy('location_loading');

    if (parks.length === 0) {
      message.info('附近暂无工厂信息');
      return;
    }

    nearbyParks.value = parks;
    recommendModalVisible.value = true;

    message.success(`找到 ${parks.length} 个附近工厂`);
  } catch (error: any) {
    message.destroy('location_loading');
    console.error('智能推荐失败:', error);

    let errorMessage = '智能推荐失败';
    let suggestion = '';

    switch (error.code) {
      case 1: {
        errorMessage = '位置权限被拒绝';
        suggestion = '请在浏览器设置中允许访问位置信息，然后刷新页面重试';

        break;
      }
      case 2: {
        errorMessage = '无法获取位置信息';
        suggestion = '请检查设备的定位服务是否开启，或尝试使用其他网络';

        break;
      }
      case 3: {
        errorMessage = '定位超时';
        suggestion = '网络较慢或GPS信号弱，请稍后重试或移动到信号较好的位置';

        break;
      }
      default: {
        if (error.message?.includes('请先配置高德地图API Key')) {
          errorMessage = 'API配置错误';
          suggestion = '请联系管理员配置高德地图API Key';
        } else {
          suggestion = '请检查网络连接或稍后重试';
        }
      }
    }

    message.error({
      content: `${errorMessage}：${suggestion}`,
      duration: 6, // 延长显示时间以便用户阅读
    });

    // 如果是定位失败，提供手动输入选项
    if (error.code === 1 || error.code === 2 || error.code === 3) {
      setTimeout(() => {
        Modal.confirm({
          cancelText: '取消',
          content: '是否手动输入地址进行搜索？',
          okText: '手动输入',
          onOk: () => {
            manualLocationModalVisible.value = true;
          },
          title: '定位失败',
        });
      }, 1000);
    }
  } finally {
    recommendLoading.value = false;
  }
}

/**
 * 关闭推荐弹窗
 */
function closeRecommendModal() {
  recommendModalVisible.value = false;
  nearbyParks.value = [];
}

function closeManualLocationModal() {
  manualLocationModalVisible.value = false;
  manualAddress.value = '';
}

/**
 * 手动搜索附近工厂
 */
async function searchByManualAddress() {
  if (!manualAddress.value.trim()) {
    message.warning('请输入地址');
    return;
  }

  recommendLoading.value = true;

  try {
    const key = import.meta.env.VITE_AMAP_KEY;
    if (!key) {
      throw new Error('请先配置高德地图API Key');
    }

    // 先进行地理编码，将地址转换为坐标
    const geocodeUrl = `https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${encodeURIComponent(manualAddress.value)}`;

    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    if (
      geocodeData.status !== '1' ||
      !geocodeData.geocodes ||
      geocodeData.geocodes.length === 0
    ) {
      throw new Error('无法识别该地址，请输入更详细的地址信息');
    }

    const location = geocodeData.geocodes[0].location;
    const [longitude, latitude] = location.split(',').map(Number);

    message.loading({
      content: '正在搜索附近工厂...',
      duration: 0,
      key: 'manual_search_loading',
    });

    // 搜索附近工厂
    const parks = await searchNearbyParks(longitude, latitude);

    message.destroy('manual_search_loading');

    if (parks.length === 0) {
      message.info('该地址附近暂无工厂信息');
      return;
    }

    nearbyParks.value = parks;
    closeManualLocationModal();
    recommendModalVisible.value = true;

    message.success(`找到 ${parks.length} 个附近工厂`);
  } catch (error: any) {
    message.destroy('manual_search_loading');
    console.error('手动搜索失败:', error);
    message.error(error.message || '搜索失败，请重试');
  } finally {
    recommendLoading.value = false;
  }
}

/**
 * 推荐表格列配置
 */
const recommendColumns = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '工厂名称',
    width: 200,
  },
  {
    dataIndex: 'address',
    ellipsis: true,
    key: 'address',
    title: '地址',
  },
  {
    customRender: ({ text }: { text: string }) => `${text}m`,
    dataIndex: 'distance',
    key: 'distance',
    title: '距离',
    width: 100,
  },
  {
    dataIndex: 'tel',
    key: 'tel',
    title: '联系电话',
    width: 120,
  },
  {
    customRender: ({ record }: { record: any }) => {
      return h(Space, {}, [
        h(
          Button,
          {
            onClick: () => {
              // 可以在这里添加选择工厂的逻辑
              message.success(`已选择工厂: ${record.name}`);
              closeRecommendModal();
            },
            size: 'small',
            type: 'link',
          },
          '选择',
        ),
      ]);
    },
    key: 'action',
    title: '操作',
    width: 100,
  },
];
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('page.agent.list')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park) => (currentPark = park)"
        />
      </template>
      <template #toolbar-tools>
        <Space>
          <Button
            type="default"
            :loading="recommendLoading"
            @click="onSmartRecommend"
          >
            <BulbOutlined class="size-4" />
            智能推荐
          </Button>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
          </Button>
        </Space>
      </template>
    </Grid>

    <!-- 智能推荐弹窗 -->
    <Modal
      v-model:open="recommendModalVisible"
      title="附近工厂推荐"
      width="800px"
      :footer="null"
      @cancel="closeRecommendModal"
    >
      <div class="mb-4 text-gray-600">
        <p>基于您的当前位置，为您推荐以下附近的工厂：</p>
      </div>

      <Table
        :columns="recommendColumns"
        :data-source="nearbyParks"
        :pagination="false"
        :scroll="{ y: 400 }"
        row-key="id"
        size="small"
      >
        <template #emptyText>
          <div class="py-8 text-center">
            <p class="text-gray-500">暂无附近工厂信息</p>
          </div>
        </template>
      </Table>

      <div class="mt-4 text-right">
        <Button @click="closeRecommendModal"> 关闭 </Button>
      </div>
    </Modal>

    <!-- 手动输入地址弹窗 -->
    <Modal
      v-model:open="manualLocationModalVisible"
      title="手动输入地址"
      width="500px"
      @cancel="closeManualLocationModal"
    >
      <div class="py-4">
        <div class="mb-4 text-gray-600">
          <p>请输入您要搜索的地址，系统将为您推荐附近的工厂：</p>
        </div>

        <div class="mb-4">
          <Input
            v-model:value="manualAddress"
            placeholder="请输入详细地址，如：北京市朝阳区建国路"
            size="large"
            @press-enter="searchByManualAddress"
          >
            <template #prefix>
              <EnvironmentOutlined class="text-gray-400" />
            </template>
          </Input>
        </div>

        <div class="text-sm text-gray-500">
          <p>提示：地址越详细，搜索结果越准确</p>
        </div>
      </div>

      <template #footer>
        <Space>
          <Button @click="closeManualLocationModal">取消</Button>
          <Button
            type="primary"
            :loading="recommendLoading"
            @click="searchByManualAddress"
          >
            搜索附近工厂
          </Button>
        </Space>
      </template>
    </Modal>
  </Page>
</template>
