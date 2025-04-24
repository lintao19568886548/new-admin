<script setup lang="ts">
import type { FloorItem } from '../data';

import { defineEmits, defineProps, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Popconfirm, Upload } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { uploadSystemParkImage } from '#/api/system/park';
import { $t } from '#/locales';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

// 添加emit定义，用于更新表单值
const emit = defineEmits(['update:modelValue']);

const floorData = ref<FloorItem[]>([]);

// 初始化时，如果有传入的modelValue，则使用它
watch(
  () => props.modelValue,
  (val) => {
    if (val && Array.isArray(val) && val.length > 0) {
      floorData.value = [...val] as FloorItem[];
      // 更新表格数据
      gridApi.setGridOptions({
        data: [...floorData.value],
      });
    }
  },
  { immediate: true },
);

const onConfirm = () => {
  // 将当前楼层数据更新到modelValue
  emit('update:modelValue', floorData.value);
  floorModalApi.close();
};

const onReset = () => {
  floorData.value = [];
  emit('update:modelValue', floorData.value);
};

// 修改 handleAddFloor 函数
async function handleAddFloor() {
  // 如果 modelValue 中有数据，则使用它
  if (
    props.modelValue &&
    Array.isArray(props.modelValue) &&
    props.modelValue.length > 0
  ) {
    floorData.value = [...props.modelValue] as FloorItem[];
    // 更新表格数据
    gridApi.setGridOptions({
      data: [...floorData.value],
    });
  }

  // 打开楼层表单Modal
  floorModalApi.open();
}

// 修改 addFloorData 函数，添加日志以便调试
const addFloorData = () => {
  // 获取当前楼层数量，用于生成新楼层的名称
  const currentFloorCount = floorData.value.length;
  // 这里添加新增行的逻辑
  floorData.value.push({
    description: '',
    floorHeight: '0',
    floorName: `${currentFloorCount + 1}层`,
    images: [],
    loadBearing: '0',
    rentPrice: '0',
    status: '空闲',
    totalArea: '0',
    usedArea: '0',
  });

  // 同时更新modelValue
  emit('update:modelValue', floorData.value);
};

// 创建楼层表单的Modal
const [FloorModal, floorModalApi] = useVbenModal({
  class: 'max-w-[90%] w-auto',
  destroyOnClose: false,
  onCancel: () => {
    floorModalApi.close();
    return false;
  },
  title: $t('page.factory.addFloor'),
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'floorName', title: '层数', width: 80 },
      {
        editRender: { name: 'input' },
        field: 'floorHeight',
        title: '层高',
      },
      {
        editRender: { name: 'input' },
        field: 'loadBearing',
        title: '承重',
      },
      {
        editRender: { name: 'input' },
        field: 'rentPrice',
        title: '租金',
      },
      {
        editRender: { name: 'input' },
        field: 'totalArea',
        title: '总面积',
      },
      {
        editRender: { name: 'input' },
        field: 'usedArea',
        title: '已用面积',
      },
      {
        editRender: { name: 'input' },
        field: 'status',
        title: '状态',
      },
      {
        editRender: { name: 'input' },
        field: 'description',
        title: '描述',
      },
      {
        fixed: 'right', // 固定在右侧，可选
        minWidth: 150, // 调整宽度以容纳按钮
        slots: { default: 'actions' }, // 使用名为 'actions' 的插槽
        title: '操作',
      },
    ],
    data: floorData.value,
    editConfig: {
      mode: 'cell',
      trigger: 'click',
    }, // 设置一个固定高度，防止溢出
    pagerConfig: {
      enabled: false,
    },
    showOverflow: true,
  },
});

// 监听 floorData 变化，更新表格数据
watch(
  floorData,
  (newVal) => {
    gridApi.setGridOptions({
      data: [...newVal],
    });
  },
  { deep: true },
);

const handleDelete = (rowIndex: number) => {
  floorData.value.splice(rowIndex, 1);
  // 重新生成层数名称，如果需要的话（可选）
  floorData.value.forEach((item, index) => {
    // 简单示例：如果 floorName 是自动生成的 'x层' 格式
    if (/^\d+层$/.test(item.floorName)) {
      item.floorName = `${index + 1}层`;
    }
  });
};

// 创建上传Modal
const [UploadModal, uploadModalApi] = useVbenModal({
  destroyOnClose: false,
  onCancel: () => {
    uploadModalApi.close();
    return false;
  },
  title: '上传楼层图片',
});

// 当前正在编辑的行索引和行数据
const currentEditRow = ref<FloorItem | null>(null);
const currentEditRowIndex = ref<null | number>(null);

// 上传的文件列表
const fileList = ref<any[]>([]);

// 打开上传Modal
const openUploadModal = (row: FloorItem, rowIndex: number) => {
  currentEditRow.value = row;
  currentEditRowIndex.value = rowIndex;
  // 如果已有上传的图片，则显示在文件列表中
  fileList.value = row.images || [];

  uploadModalApi.open();
};

// 处理上传完成
const handleUploadComplete = () => {
  if (
    currentEditRow.value &&
    currentEditRowIndex.value !== null &&
    fileList.value.length > 0
  ) {
    // 更新行数据 - 保存所有上传的图片
    const filterImages = fileList.value.filter(
      (file) => file.status === 'done' && file.url,
    );

    const uploadedImages = filterImages.map((item) => ({
      imgUrl: item.url,
    }));

    if (uploadedImages.length > 0 && currentEditRowIndex.value !== null) {
      // 保存所有图片信息到楼层数据中
      if (floorData.value[currentEditRowIndex.value]) {
        floorData.value[currentEditRowIndex.value].images = uploadedImages;
      }

      // 更新modelValue
      emit('update:modelValue', floorData.value);

      // 关闭Modal
      uploadModalApi.close();

      // 显示成功消息
      message.success(`成功上传${uploadedImages.length}张图片`);
    }
  }
};

// 修改上传函数，适配Modal中的上传组件
const uploadParkImage = async (options: any) => {
  const { file, onError, onSuccess } = options;
  // 文件类型检查
  const isImageType =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/jpg';
  if (!isImageType) {
    message.error('只能上传JPG/PNG格式的图片!');
    return false;
  }

  // 文件大小限制（5MB）
  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isLt5M) {
    message.error('图片必须小于5MB!');
    return false;
  }

  try {
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', file);

    // 使用FormData对象发送请求
    const response = await uploadSystemParkImage(formData);

    // 上传成功
    if (response) {
      // 确保 response.url 是一个有效的 HTTP URL
      onSuccess({ ...response });

      // 更新文件列表 - 添加新上传的图片到列表中，而不是替换整个列表
      const newFile = {
        name: file.name,
        status: 'done',
        uid: file.uid,
        url: response.url,
      };

      // 查找是否已存在相同uid的文件，如果存在则更新，否则添加
      const existingFileIndex = fileList.value.findIndex(
        (item) => item.uid === file.uid,
      );
      if (existingFileIndex === -1) {
        fileList.value.push(newFile);
      } else {
        fileList.value[existingFileIndex] = newFile;
      }

      return true;
    } else {
      onError(new Error(response?.message || '上传失败'));
      message.error(response?.message || '上传失败');
      return false;
    }
  } catch (error) {
    onError(error);
    message.error('上传失败');
    return false;
  }
};
</script>
<template>
  <div>
    <Button type="primary" @click="handleAddFloor">
      {{ $t('page.factory.addFloor') }}
    </Button>
    <div
      v-show="props.modelValue && props.modelValue.length > 0"
      class="ml-2 inline-block text-green-500"
    >
      已添加 {{ props.modelValue.length }} 层数据
    </div>
    <FloorModal>
      <Grid>
        <template #actions="{ row, rowIndex }">
          <div class="flex items-center justify-center gap-2">
            <Button
              type="link"
              size="small"
              @click="openUploadModal(row, rowIndex)"
            >
              {{
                row.images && row.images.length > 0
                  ? `查看图片(${row.images.length})`
                  : '上传图片'
              }}
            </Button>
            <Popconfirm title="确认删除" @confirm="handleDelete(rowIndex)">
              <Button type="link" danger size="small"> 删除 </Button>
            </Popconfirm>
          </div>
        </template>
      </Grid>
      <template #footer>
        <div class="flex w-full justify-between">
          <div class="flex gap-3">
            <Button type="primary" @click="addFloorData"> 添加一行 </Button>
            <Button type="primary" @click="onReset()"> 重置 </Button>
          </div>
          <div class="flex gap-2">
            <Button @click="floorModalApi.close()">取消</Button>
            <Button type="primary" @click="onConfirm()"> 确认 </Button>
          </div>
        </div>
      </template>
    </FloorModal>
    <UploadModal>
      <div class="p-4">
        <Upload
          :custom-request="uploadParkImage"
          :file-list="fileList"
          :show-upload-list="true"
          accept="image/jpeg,image/png,image/jpg"
          list-type="picture"
          name="file"
          multiple
          @change="(info) => (fileList = info.fileList)"
        >
          <Button type="primary">选择文件</Button>
          <div class="mt-2 text-gray-500">
            支持 .jpg/.png 格式，文件大小不超过5MB
          </div>
        </Upload>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="uploadModalApi.close()">取消</Button>
          <Button type="primary" @click="handleUploadComplete()">确认</Button>
        </div>
      </template>
    </UploadModal>
  </div>
</template>
