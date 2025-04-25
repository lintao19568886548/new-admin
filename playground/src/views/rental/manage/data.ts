import type { RentalManagementItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { markRaw } from 'vue';

import { message } from 'ant-design-vue';

// 添加 dayjs 导入
import { z } from '#/adapter/form';
import { uploadImage } from '#/api/image';
import { $t } from '#/locales';

import DormitoryForm from './modules/dormitory-form.vue';
import FactoryForm from './modules/factory-form.vue';
import FloorForm from './modules/floor-form.vue';
import MultiSelect from './modules/multi-select.vue';

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
  factoryName: string;
  floors?: FloorItem[];
  parkId: number;
}

// 定义宿舍接口
export interface Dormitory {
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

const uploadParkImage = async (options: any) => {
  const { data, file, onError, onSuccess } = options;
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

    // 使用FormData对象发送请求 - 这里修改为传递formData
    const response = await uploadImage(formData);

    // 上传成功
    if (response) {
      // 获取当前表单中的images字段值
      const currentImages = data?.images || [];

      // 将新上传的图片添加到现有图片数组中，而不是替换它
      const updatedImages = [...currentImages, { ...response }];

      // 更新表单中的images字段
      onSuccess({ images: updatedImages });
      message.success('上传成功');
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
      formItemClass: 'col-span-2',
      label: $t('page.park.description'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
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
      component: 'Input',
      fieldName: 'factoryName', // 修改为与接口一致
      label: $t('page.factory.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address', // 保持不变，已与接口一致
      label: $t('page.factory.address'),
      rules: 'required',
    },
    // {
    //   component: 'InputNumber',
    //   componentProps: {
    //     style: { width: '100%' },
    //   },
    //   fieldName: 'area', // 修改为与接口一致
    //   label: $t('page.factory.area'),
    //   rules: 'required',
    // },
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
      rules: 'required',
    },
    // {
    //   component: 'Upload',
    //   componentProps: {
    //     // 更多属性见：https://ant.design/components/upload-cn
    //     accept: '.png,.jpg,.jpeg',
    //     // 自动携带认证信息
    //     customRequest: uploadParkImage,
    //     disabled: false,
    //     multiple: true,
    //     // 添加图片预览功能
    //     onPreview: (file: any) => {
    //       // 获取图片URL
    //       const imageUrl = file.url || (file.response && file.response.url);
    //       // 创建图片预览
    //       if (imageUrl) {
    //         const image = new Image();
    //         image.src = imageUrl;
    //         const imgWindow = window.open('', '_blank');
    //         if (imgWindow) {
    //           // 使用 DOM API 替代 document.write
    //           imgWindow.document.body.innerHTML = '';
    //           const imgElement = imgWindow.document.createElement('img');
    //           imgElement.src = imageUrl;
    //           imgElement.style.maxWidth = '100%';
    //           imgElement.style.maxHeight = '100%';
    //           imgElement.style.position = 'absolute';
    //           imgElement.style.top = '50%';
    //           imgElement.style.left = '50%';
    //           imgElement.style.transform = 'translate(-50%, -50%)';
    //           imgWindow.document.body.append(imgElement);
    //           imgWindow.document.title = file.name || '图片预览';
    //         } else {
    //           // 如果弹窗被阻止，则直接在新标签页打开
    //           window.open(imageUrl, '_blank');
    //         }
    //       } else {
    //         message.warning('无法预览，图片URL不存在');
    //       }
    //     },
    //     // 添加预览处理函数
    //     showUploadList: true,
    //     // 上传列表的内建样式，支持四种基本样式 text, picture, picture-card 和 picture-circle
    //     listType: 'picture-card',
    //   },
    //   fieldName: 'images',
    //   label: $t('page.factory.images'),
    //   renderComponentContent: () => {
    //     return {
    //       default: () => $t('page.factory.upload-image'),
    //     };
    //   },
    // },
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
      formItemClass: 'col-span-2',
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
      disabledOnChangeListener: false,
      fieldName: 'floors', // 保持不变，已与接口一致
      formItemClass: 'col-span-2',
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
          width: '90%',
        },
      },
      fieldName: 'floorName',
      label: $t('page.floor.name'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: {
          width: '90%',
        },
      },
      fieldName: 'floorHeight',
      label: $t('page.floor.height'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: {
          width: '90%',
        },
      },
      fieldName: 'loadBearing',
      label: $t('page.floor.loadBearing'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: {
          width: '90%',
        },
      },
      fieldName: 'rentPrice',
      label: $t('page.floor.rentPrice'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: {
          width: '90%',
        },
      },
      fieldName: 'totalArea',
      label: $t('page.floor.totalArea'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: {
          width: '90%',
        },
      },
      fieldName: 'usedArea',
      label: $t('page.floor.usedArea'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        style: {
          width: '90%',
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
      formItemClass: 'col-span-4',
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
        customRequest: uploadParkImage,
        disabled: false,
        multiple: true,
        // 添加图片预览功能
        onPreview: (file: any) => {
          // 获取图片URL
          const imageUrl = file.url || (file.response && file.response.url);
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
        },
        // 添加预览处理函数
        showUploadList: true,
        // 上传列表的内建样式，支持四种基本样式 text, picture, picture-card 和 picture-circle
        listType: 'picture-card',
      },
      fieldName: 'images',
      formItemClass: 'col-span-4',
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
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'floorCount',
      label: $t('page.dormitory.floorCount'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'roomArea',
      label: $t('page.dormitory.roomArea'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'totalRooms',
      label: $t('page.dormitory.totalRooms'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'floorHeightFirst',
      label: $t('page.dormitory.floorHeightFirst'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'rentPriceFirst',
      label: $t('page.dormitory.rentPriceFirst'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'usedRoomsFirst',
      label: $t('page.dormitory.usedRoomsFirst'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'floorHeightOther',
      label: $t('page.dormitory.floorHeightOther'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'rentPriceOther',
      label: $t('page.dormitory.rentPriceOther'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: 0,
      fieldName: 'usedRoomsOther',
      label: $t('page.dormitory.usedRoomsOther'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        style: { width: '90%' },
      },
      defaultValue: ' ',
      fieldName: 'dormitoryName',
      label: $t('page.dormitory.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        style: { width: '90%' },
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
      field: 'status',
      minWidth: 150,
      title: $t('page.park.status'),
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
