<script lang="ts" setup>
import type { InvestmentAgent } from './data';

import {
  computed,
  createApp,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  BulbOutlined,
  EnvironmentOutlined,
  MoreOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Flex,
  Image,
  Input,
  List,
  message,
  Modal,
  Popover,
  Table,
  Tag,
  TypographyText,
} from 'ant-design-vue';

import { deleteInvestment, getInvestmentList } from '#/api/investment';
import { $t } from '#/locales';

import { getTagTypeOptions } from './data'; // 引入获取标签颜色函数
import Form from './modules/form.vue';

const loading = ref(false);
const investmentList = ref<InvestmentAgent[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10, // 移动端每页数量可以少一些
  total: 0,
});
const recommendModalVisible = ref(false);
const recommendLoading = ref(false);
const nearbyParks = ref<any[]>([]);
const manualLocationModalVisible = ref(false);
const manualAddress = ref('');

const tagTypeOptions = getTagTypeOptions();

const getTagColor = (value: string) => {
  const option = tagTypeOptions.find((opt) => opt.value === value);
  return option ? option.color : 'default';
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onEdit(row: InvestmentAgent) {
  const rowData = { ...row };
  rowData.meetingTime = String(formatDateTime(rowData.meetingTime));
  formModalApi.setData(rowData).open();
}

async function onDelete(row: InvestmentAgent) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.agentName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  const { investmentId } = row;
  if (investmentId) {
    try {
      await deleteInvestment(investmentId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
        key: 'action_process_msg',
      });
      fetchList();
    } catch (error) {
      console.error('删除投资项目失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

function onView(row: InvestmentAgent) {
  let imgList: string[] = [];
  if (Array.isArray(row.imageUrlList)) {
    imgList = row.imageUrlList;
  } else if (row.imageUrlList) {
    imgList = [row.imageUrlList];
  }

  if (imgList.length === 0) {
    message.info($t('page.agent.noImages'));
    return;
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
          Image.PreviewGroup,
          {
            preview: {
              onVisibleChange: (v) => {
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
          imgList.map((src: string) =>
            h(Image, {
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

async function fetchList() {
  loading.value = true;
  const params = {
    currentPage: pagination.value.currentPage,
    currentPark: -1, // 显示所有区域
    pageSize: pagination.value.pageSize,
    // 在这里可以添加来自 list.vue 的其他表单筛选参数，如果需要的话
    // 例如: agentName: searchForm.value.agentName, 等
  };
  try {
    const result = await getInvestmentList(params);
    investmentList.value = result.items || [];
    pagination.value.total = result.page?.total || 0;
  } catch (error) {
    console.error('获取投资项目列表失败:', error);
    message.error('获取投资项目列表失败');
    investmentList.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

function handleTableChange(page: number, pageSize: number) {
  pagination.value.currentPage = page;
  pagination.value.pageSize = pageSize;
  fetchList();
}

function refreshList() {
  pagination.value.currentPage = 1;
  fetchList();
}

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
  const url = `https://restapi.amap.com/v3/place/around?key=${key}&location=${longitude},${latitude}&keywords=工厂&types=170300&radius=5000&offset=20&page=1&extensions=all`;

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
    manualLocationModalVisible.value = false;
    recommendModalVisible.value = true;
    manualAddress.value = '';

    message.success(`找到 ${parks.length} 个附近工厂`);
  } catch (error: any) {
    message.destroy('manual_search_loading');
    console.error('手动搜索失败:', error);
    message.error(error.message || '搜索失败，请重试');
  } finally {
    recommendLoading.value = false;
  }
}

// 推荐表格列定义
const recommendColumns = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '工厂名称',
    width: 200,
  },
  {
    dataIndex: 'address',
    key: 'address',
    title: '地址',
    width: 250,
  },
  {
    dataIndex: 'distance',
    key: 'distance',
    render: (distance: string) => `${distance}米`,
    title: '距离',
    width: 100,
  },
  {
    dataIndex: 'tel',
    key: 'tel',
    title: '联系电话',
    width: 150,
  },
  {
    customRender: ({ record }: { record: any }) => {
      return h(
        Button,
        {
          onClick: () => {
            message.success(`已选择工厂: ${record.name}`);
            closeRecommendModal();
          },
          size: 'small',
          type: 'link',
        },
        '选择',
      );
    },
    key: 'action',
    title: '操作',
    width: 100,
  },
];

onMounted(() => {
  fetchList();
});

// 计算属性，用于控制页面主体样式，模拟400x641的比例 (可选)
const pageStyle = computed(() => ({
  // maxWidth: '400px', // 控制最大宽度
  // margin: '0 auto', // 居中
  // border: '1px solid #eee', // 可选边框
  // overflowY: 'auto', // 内容超出时滚动
  // height: '641px' // 固定高度，如果需要模拟精确视口
}));
</script>

<template>
  <Page :style="pageStyle" class="mobile-investment-list-page">
    <FormModal @success="refreshList" />

    <div class="p-2">
      <List
        :data-source="investmentList"
        :loading="loading"
        :pagination="{
          current: pagination.currentPage,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handleTableChange,
          size: 'small',
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }"
        item-layout="vertical"
        row-key="investmentId"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <Card :title="item.agentName" size="small" class="mb-2 shadow-md">
              <template #extra>
                <Popover title="操作" trigger="click" placement="leftTop">
                  <template #content>
                    <Flex vertical gap="small">
                      <Button type="link" size="small" @click="onView(item)">
                        {{ $t('ui.action.view') }}
                      </Button>
                      <Button type="link" size="small" @click="onEdit(item)">
                        {{ $t('ui.action.edit') }}
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        @click="onDelete(item)"
                      >
                        {{ $t('ui.action.delete') }}
                      </Button>
                    </Flex>
                  </template>
                  <Button type="text" size="small">
                    <MoreOutlined />
                  </Button>
                </Popover>
              </template>

              <Flex vertical gap="small">
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.tenant.name') }}:
                  </TypographyText>
                  <TypographyText>{{ item.tenantName }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.intentLevel') }}:
                  </TypographyText>
                  <Tag :color="getTagColor(item.intentLevel)">
                    {{ item.intentLevel }}
                  </Tag>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.intentArea') }}:
                  </TypographyText>
                  <TypographyText>{{ item.intentArea }} ㎡</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.progress') }}:
                  </TypographyText>
                  <TypographyText>{{ item.progress }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.phone') }}:
                  </TypographyText>
                  <TypographyText>{{ item.phoneNumber }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.common.date') }}:
                  </TypographyText>
                  <TypographyText>
                    {{ formatDateTime(item.meetingTime) }}
                  </TypographyText>
                </div>
                <div v-if="item.parkName">
                  <TypographyText type="secondary">
                    {{ $t('page.common.park') }}:
                  </TypographyText>
                  <TypographyText>{{ item.parkName }}</TypographyText>
                </div>
                <div v-if="item.remark">
                  <TypographyText type="secondary">
                    {{ $t('page.common.remark') }}:
                  </TypographyText>
                  <TypographyText>{{ item.remark }}</TypographyText>
                </div>
              </Flex>
            </Card>
          </List.Item>
        </template>
      </List>
    </div>

    <!-- 悬浮智能推荐按钮 -->
    <Button
      type="primary"
      shape="circle"
      size="large"
      :loading="recommendLoading"
      @click="onSmartRecommend"
      class="floating-recommend-btn"
    >
      <BulbOutlined class="text-xl" />
    </Button>

    <!-- 智能推荐弹窗 -->
    <Modal
      v-model:open="recommendModalVisible"
      title="附近工厂推荐"
      width="90%"
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
        :scroll="{ y: 300, x: 600 }"
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
      width="90%"
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

<style lang="less" scoped>
// 可以在这里添加特定于移动端的样式
.mobile-investment-list-page {
  position: relative;
  // background-color: #f0f2f5; // 设置页面背景色

  // :deep(.ant-card-head) {
  //   padding: 0 12px;
  //   min-height: 38px;
  // }
  // :deep(.ant-card-body) {
  //   padding: 12px;
  // }
  // :deep(.ant-list-item) {
  //   padding: 8px 0;
  // }
  // :deep(.ant-list-pagination) {
  //   margin-top: 16px;
  //   padding: 0 8px; // 为分页器添加一些内边距
  // }
}

// 悬浮智能推荐按钮样式
.floating-recommend-btn {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 60px;
  height: 60px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }

  // 确保图标居中
  :deep(.anticon) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
