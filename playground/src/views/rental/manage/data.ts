import type { RentalManagementItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { markRaw } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

// 添加 dayjs 导入
import { z } from '#/adapter/form';
import MultiSelect from '#/components/MultiSelect.vue';
import { $t } from '#/locales';

import DormitoryForm from './modules/dormitory-form.vue';
import FactoryForm from './modules/factory-form.vue';
import FloorForm from './modules/floor-form.vue';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();
// 定义楼层数据的接口
export interface FloorItem {
  description: string;
  floorHeight: number;
  floorName: string;
  images: object[];
  loadBearing: number;
  rentPrice: number;
  status: string;
  totalArea: number;
  usedArea: number;
}

// 定义工厂接口
export interface Factory {
  address: string;
  area: number;
  buildTime?: string;
  contact: string;
  description?: string;
  factoryId: number;
  factoryName: string;
  floors?: FloorItem[];
  parkId: number;
}

// 定义宿舍接口
export interface Dormitory {
  dormitoryId: number;
  dormitoryName: string;
  floorCount: number;
  floorHeightFirst: number;
  floorHeightOther: number;
  parkId: number;
  remark?: string;
  rentPriceFirst: number;
  rentPriceOther: number;
  roomArea: number;
  totalRooms: number;
  usedRoomsFirst: number;
  usedRoomsOther: number;
}

const imageOnChange = (info: any) => {
  const { file } = info;
  if (file.status === 'done') {
    // 从响应中获取文件名，如果后端没返回，则使用原始文件名
    const name = file.response?.data?.name || file.name;
    message.success(`${name} 上传成功`);
  } else if (file.status === 'error') {
    // 尝试从后端响应获取更详细的错误信息
    const errorMsg = file.response?.message || '上传失败';
    message.error(`${file.name} ${errorMsg}`);
    console.error('Upload Error Response:', file.response); // 可以在控制台查看详细错误
  }
  // 你也可以在这里处理 'uploading' 状态，例如显示加载指示
};

const imageOnPreview = (file: any) => {
  // 获取图片URL
  const imageUrl = file.url || file.response.data.url;
  // 创建图片预览
  if (imageUrl) {
    const image = new Image();
    image.src = imageUrl;
    const imgWindow = window.open('', '_blank');
    if (imgWindow) {
      // 使用 DOM API 替代 document.write
      imgWindow.document.body.innerHTML = '';
      const imgElement = imgWindow.document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.style.maxWidth = '100%';
      imgElement.style.maxHeight = '100%';
      imgElement.style.position = 'absolute';
      imgElement.style.top = '50%';
      imgElement.style.left = '50%';
      imgElement.style.transform = 'translate(-50%, -50%)';
      imgWindow.document.body.append(imgElement);
      imgWindow.document.title = file.name || '图片预览';
    } else {
      // 如果弹窗被阻止，则直接在新标签页打开
      window.open(imageUrl, '_blank');
    }
  } else {
    message.warning('无法预览，图片URL不存在');
  }
};

const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('只能上传图片文件!');
  }
  const isLt2M = file.size / 1024 / 1024 < 10;
  if (!isLt2M) {
    message.error('图片必须小于10MB!');
  }
  return isImage && isLt2M;
};

/**
 * 获取园区表单的字段配置
 */
export function useParkFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'parkName',
      label: $t('page.park.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('page.park.address'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm²',
        style: { width: '100%' },
      },
      fieldName: 'area',
      label: $t('page.park.area'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'manager',
      label: $t('page.park.manager'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'contact',
      label: $t('page.park.contact'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 300,
        rows: 5,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'description',
      formItemClass: 'col-span-1 md:col-span-2',
      label: $t('page.park.description'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
    },
    {
      component: 'Upload',
      componentProps: {
        // 更多属性见：https://ant.design/components/upload-cn
        accept: '.png,.jpg,.jpeg',
        // 自动携带认证信息
        // customRequest: uploadParkImage,
        action: `${apiURL}/image/upload`,
        beforeUpload,
        headers: {
          Authorization: `Bearer ${accessStore.accessToken}`,
        },
        // 添加 onChange 处理函数以显示上传状态消息
        onChange: imageOnChange,
        onPreview: imageOnPreview,
        listType: 'picture-card',
        // 添加预览处理函数
        // showUploadList: true,
        // 上传列表的内建样式，支持四种基本样式 text, picture, picture-card 和 picture-circle
      },
      fieldName: 'images',
      formItemClass: 'col-span-1 md:col-span-2',
      label: $t('page.factory.images'),
      renderComponentContent: () => {
        return {
          default: () => $t('page.factory.upload-image'),
        };
      },
    },
  ];
}

export function useFactoryFormSchema(): VbenFormSchema[] {
  return [
    {
      component: markRaw(FactoryForm),
      fieldName: 'factories',
    },
  ];
}
/**
 * 获取厂房表单的字段配置
 */
export function useFactoryItemFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'AutoComplete',
      componentProps: {
        // 添加自定义筛选函数
        filterOption: (inputValue: string, option: { value: string }) => {
          // 如果 option 或 option.value 不存在，则不匹配
          if (!option || !option.value) {
            return false;
          }
          // 将输入值和选项值都转为小写进行比较
          return option.value.toLowerCase().includes(inputValue.toLowerCase());
        },
        options: [
          { value: 'A栋建筑' },
          { value: 'B栋建筑' },
          { value: 'C栋建筑' },
          { value: 'D栋建筑' },
          { value: 'E栋建筑' },
        ],
        placeholder: '请输入或选择厂房名称',
        style: {
          width: '100%',
        },
      },
      fieldName: 'factoryName',
      label: $t('page.factory.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address', // 保持不变，已与接口一致
      label: $t('page.factory.address'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'contact', // 修改为与接口一致
      label: $t('page.factory.contact'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: '请选择建造时间',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD', // 添加valueFormat指定输出格式
      },
      fieldName: 'buildTime', // 保持不变，已与接口一致
      label: $t('page.factory.buildTime'),
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 300,
        rows: 5,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'description', // 保持不变，已与接口一致
      formItemClass: 'col-span-1 md:col-span-2',
      label: $t('page.factory.description'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
    },
    {
      component: markRaw(FloorForm),
      fieldName: 'floors', // 保持不变，已与接口一致
      formItemClass: 'col-span-1 md:col-span-2',
      label: $t('page.factory.floors'),
    },
  ];
}

/**
 * 获取厂房楼层表单的字段配置
 */
export function useFloorFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        style: {
          width: '100%',
        },
      },
      fieldName: 'floorName',
      label: $t('page.floor.name'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm',
        style: {
          width: '100%',
        },
      },
      fieldName: 'floorHeight',
      label: $t('page.floor.height'),
      rules: z.coerce
        .number({
          required_error: $t('ui.formRules.required', [
            $t('page.floor.height'),
          ]),
        })
        .min(0, '层高不能为负数'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '吨',
        style: {
          width: '100%',
        },
      },
      fieldName: 'loadBearing',
      label: $t('page.floor.loadBearing'),
      rules: z.coerce
        .number({
          required_error: $t('ui.formRules.required', [
            $t('page.floor.loadBearing'),
          ]),
        })
        .min(0, '承重不能为负数'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/m²·月',
        style: {
          width: '100%',
        },
      },
      fieldName: 'rentPrice',
      label: $t('page.floor.rentPrice'),
      rules: z.coerce
        .number({
          required_error: $t('ui.formRules.required', [
            $t('page.floor.rentPrice'),
          ]),
        })
        .min(0, '租金不能为负数'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm²',
        style: {
          width: '100%',
        },
      },
      fieldName: 'totalArea',
      label: $t('page.floor.totalArea'),
      rules: z.coerce
        .number({
          required_error: $t('ui.formRules.required', [
            $t('page.floor.totalArea'),
          ]),
        })
        .min(0, '总面积不能为负数'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm²',
        style: {
          width: '100%',
        },
      },
      dependencies: {
        rules: (values) => {
          const totalArea = Number(values.totalArea) || 0;

          return z.coerce
            .number({
              required_error: $t('ui.formRules.required', [
                $t('page.floor.usedArea'),
              ]),
            })
            .min(0, '已用面积不能为负数')
            .refine(
              (val) => {
                // 如果总面积为0或未填写，则不进行比较验证
                if (!totalArea) return true;
                return val <= totalArea;
              },
              {
                message: '已用面积不能大于总面积',
              },
            );
        },
        triggerFields: ['totalArea', 'usedArea'],
      },
      fieldName: 'usedArea',
      label: $t('page.floor.usedArea'),
      rules: z.coerce
        .number({
          required_error: $t('ui.formRules.required', [
            $t('page.floor.usedArea'),
          ]),
        })
        .min(0, '已用面积不能为负数'),
    },
    {
      component: 'Input',
      componentProps: {
        style: {
          width: '100%',
        },
      },
      fieldName: 'status',
      label: $t('page.floor.status'),
      rules: 'required',
    },

    {
      component: 'Textarea',
      componentProps: {
        maxLength: 300,
        rows: 5,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'description',
      formItemClass: 'col-span-1 md:col-span-4',
      label: $t('page.factory.description'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
    },
    {
      component: 'Upload',
      componentProps: {
        // 更多属性见：https://ant.design/components/upload-cn
        accept: '.png,.jpg,.jpeg',
        // 自动携带认证信息
        // customRequest: uploadParkImage,
        action: `${apiURL}/image/upload`,
        beforeUpload,
        headers: {
          Authorization: `Bearer ${accessStore.accessToken}`,
        },
        // 添加 onChange 处理函数以显示上传状态消息
        onChange: imageOnChange,
        onPreview: imageOnPreview,
        listType: 'picture-card',
        // 添加预览处理函数
        // showUploadList: true,
        // 上传列表的内建样式，支持四种基本样式 text, picture, picture-card 和 picture-circle
      },
      fieldName: 'images',
      formItemClass: 'col-span-1 md:col-span-4',
      label: $t('page.factory.images'),
      renderComponentContent: () => {
        return {
          default: () => $t('page.factory.upload-image'),
        };
      },
    },
  ];
}

/**
 * 获取宿舍表单的字段配置
 */

export function useDormitoryFormSchema(): VbenFormSchema[] {
  return [
    {
      component: markRaw(DormitoryForm),
      fieldName: 'dormitories',
    },
  ];
}

export function useDormitoryItemFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'AutoComplete',
      componentProps: {
        // 添加自定义筛选函数
        filterOption: (inputValue: string, option: { value: string }) => {
          // 如果 option 或 option.value 不存在，则不匹配
          if (!option || !option.value) {
            return false;
          }
          // 将输入值和选项值都转为小写进行比较
          return option.value.toLowerCase().includes(inputValue.toLowerCase());
        },
        options: [
          { value: 'A栋宿舍' },
          { value: 'B栋宿舍' },
          { value: 'C栋宿舍' },
          { value: 'D栋宿舍' },
          { value: 'E栋宿舍' },
        ],
        placeholder: '请输入或选择厂房名称',
        style: {
          width: '100%',
        },
      },
      defaultValue: '',
      fieldName: 'dormitoryName',
      label: $t('page.dormitory.name'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '层',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'floorCount',
      label: $t('page.dormitory.floorCount'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm²',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'roomArea',
      label: $t('page.dormitory.roomArea'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '间',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'totalRooms',
      label: $t('page.dormitory.totalRooms'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'floorHeightFirst',
      label: $t('page.dormitory.floorHeightFirst'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/m²·月',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'rentPriceFirst',
      label: $t('page.dormitory.rentPriceFirst'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '间',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'usedRoomsFirst',
      label: $t('page.dormitory.usedRoomsFirst'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: 'm',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'floorHeightOther',
      label: $t('page.dormitory.floorHeightOther'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/m²·月',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'rentPriceOther',
      label: $t('page.dormitory.rentPriceOther'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '间',
        style: { width: '100%' },
      },
      defaultValue: 0,
      fieldName: 'usedRoomsOther',
      label: $t('page.dormitory.usedRoomsOther'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        style: { width: '100%' },
      },
      fieldName: 'remark',
      label: $t('page.common.remark'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
    },
    {
      component: 'Upload',
      componentProps: {
        // 更多属性见：https://ant.design/components/upload-cn
        accept: '.png,.jpg,.jpeg',
        // 自动携带认证信息
        // customRequest: uploadParkImage,
        action: `${apiURL}/image/upload`,
        beforeUpload,
        headers: {
          Authorization: `Bearer ${accessStore.accessToken}`,
        },
        // 添加 onChange 处理函数以显示上传状态消息
        onChange: imageOnChange,
        onPreview: imageOnPreview,
        listType: 'picture-card',
        // 添加预览处理函数
        // showUploadList: true,
        // 上传列表的内建样式，支持四种基本样式 text, picture, picture-card 和 picture-circle
      },
      fieldName: 'images',
      formItemClass: 'col-span-1 md:col-span-3',
      label: $t('page.factory.images'),
      renderComponentContent: () => {
        return {
          default: () => $t('page.factory.upload-image'),
        };
      },
    },
  ];
}

/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'parkName',
      label: $t('page.park.name'),
    },
    {
      component: markRaw(MultiSelect),
      // 添加 componentProps 来传递 unit
      componentProps: {
        unit: 'm²', // 设置单位为 m²
      },
      disabledOnChangeListener: false,
      fieldName: 'area',
      label: $t('page.park.area'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('page.park.address'),
    },

    // 修改为输入框
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = RentalManagementItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'parkName',
      minWidth: 150,
      title: $t('page.park.name'),
    },
    {
      field: 'address',
      minWidth: 120,
      title: $t('page.park.address'),
    },
    {
      field: 'area',
      formatter: ({ cellValue }) => {
        if (cellValue === undefined || cellValue === null) return '';
        if (Number.isNaN(Number(cellValue))) return cellValue; // 处理非纯数值类型
        return `${cellValue}m²`;
      },
      minWidth: 120,
      title: $t('page.park.area'),
    },
    {
      field: 'manager', // 新增 manager 字段
      minWidth: 120,
      title: $t('page.park.manager'),
    },
    {
      field: 'contact', // 新增 contact 字段
      minWidth: 120,
      title: $t('page.park.contact'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'factoryName',
          nameTitle: $t('system.rental.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
          'edit', // 默认的编辑按钮
          'delete', // 默认的删除按钮
        ],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 150,
      title: $t('system.rental.operation'),
    },
  ];
}
