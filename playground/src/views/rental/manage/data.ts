import type { RentalManagementItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { markRaw } from 'vue';

// 添加 dayjs 导入
import { z } from '#/adapter/form';
import { $t } from '#/locales';

import DormitoryForm from './modules/dormitory-form.vue';
import FactoryForm from './modules/factory-form.vue';
import FloorModal from './modules/floor-modal.vue';
import MultiSelect from './modules/multi-select.vue';

// 定义楼层数据的接口
export interface FloorItem {
  description: string;
  floorHeight: string;
  floorName: string;
  loadBearing: string;
  rentPrice: string;
  status: string;
  totalArea: string;
  usedArea: string;
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
      fieldName: 'status',
      label: $t('page.park.status'),
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
    },
    {
      component: markRaw(FloorModal),
      disabledOnChangeListener: false,
      fieldName: 'floors', // 保持不变，已与接口一致
      label: $t('page.factory.floors'),
    },
    {
      component: 'Upload',
      componentProps: {
        // 更多属性见：https://ant.design/components/upload-cn
        accept: '.png,.jpg,.jpeg',
        // 自动携带认证信息
        // customRequest: upload_file,
        disabled: false,
        maxCount: 1,
        multiple: false,
        showUploadList: true,
        // 上传列表的内建样式，支持四种基本样式 text, picture, picture-card 和 picture-circle
        listType: 'picture-card',
      },
      fieldName: 'files',
      label: $t('page.factory.images'),
      renderComponentContent: () => {
        return {
          default: () => $t('page.factory.upload-image'),
        };
      },
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
  ];
}

/**
 * 获取厂房楼层表单的字段配置
 */
export function useFloorFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'floorName',
      label: $t('page.floor.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'floorHeight',
      label: $t('page.floor.height'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'loadBearing',
      label: $t('page.floor.loadBearing'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'rentPrice',
      label: $t('page.floor.rentPrice'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'totalArea',
      label: $t('page.floor.totalArea'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'usedArea',
      label: $t('page.floor.usedArea'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'status',
      label: $t('page.floor.status'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'images',
      label: $t('page.floor.upload'),
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
      label: $t('page.factory.description'),
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
