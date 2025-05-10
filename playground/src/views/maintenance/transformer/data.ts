import type { TransformerItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
// import { getParkList } from '#/api/park'; // 将被替换或不再直接使用
import { getFactoryListByParkId } from '#/api/factory'; // 新增导入
import { $t } from '#/locales';

// 定义一个模块级变量来缓存园区厂房的级联选择器选项
let parkFactoryCascaderOptionsCache: Array<any> | null = null;
// 新增：用于跟踪正在进行的API请求的Promise
let parkFactoryCascaderOptionsPromise: null | Promise<Array<any>> = null;

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'green',
      label: $t('system.maintenance.transformer.status.normal'),
      value: '正常',
    },
    {
      color: 'red',
      label: $t('system.maintenance.transformer.status.abnormal'),
      value: '异常',
    },
    {
      color: 'processing',
      label: $t('system.maintenance.transformer.status.maintenance'),
      value: '维护',
    },
  ];
}

/**
 * 获取园区及厂房的级联选择器选项
 */
export async function getParkFactoryCascaderOptions(): Promise<Array<any>> {
  // 1. 如果缓存中已有数据，则直接返回缓存数据的副本
  if (parkFactoryCascaderOptionsCache !== null) {
    return [...parkFactoryCascaderOptionsCache];
  }

  // 2. 如果已有正在进行的请求，则返回该请求的Promise
  if (parkFactoryCascaderOptionsPromise) {
    return parkFactoryCascaderOptionsPromise;
  }

  // 3. 没有缓存且没有正在进行的请求，发起新的API调用
  parkFactoryCascaderOptionsPromise = (async () => {
    try {
      const allFactoriesResponse = await getFactoryListByParkId();
      if (
        allFactoriesResponse &&
        Array.isArray(allFactoriesResponse) &&
        allFactoriesResponse.length > 0
      ) {
        const allFactories = allFactoriesResponse as Array<{
          factoryId: number;
          factoryName: string;
          park: { parkName: string };
          parkId: number;
        }>;

        const parksMap = new Map<
          number,
          {
            children: Array<{ isLeaf: boolean; name: string; value: number }>;
            name: string;
            value: number;
          }
        >();

        for (const factory of allFactories) {
          if (!parksMap.has(factory.parkId)) {
            parksMap.set(factory.parkId, {
              name: factory.park.parkName, // 园区名称
              value: factory.parkId, // 园区ID
              children: [],
            });
          }
          // 为对应园区添加厂房
          const parkEntry = parksMap.get(factory.parkId);
          if (parkEntry) {
            parkEntry.children.push({
              isLeaf: true, // 厂房是叶子节点
              name: factory.factoryName, // 厂房名称
              value: factory.factoryId, // 厂房ID
            });
          }
        }
        const processedData = [...parksMap.values()];
        // 将处理后的数据存入缓存
        parkFactoryCascaderOptionsCache = processedData;
        return [...processedData]; // 返回处理后数据的副本
      } else {
        console.error(
          '加载园区或厂房数据失败 (getParkFactoryCascaderOptions): 未获取到有效数据或数据为空',
        );
        parkFactoryCascaderOptionsCache = null; // 清空缓存
        return [];
      }
    } catch (error) {
      console.error(
        '加载园区及厂房数据失败 (getParkFactoryCascaderOptions):',
        error,
      );
      parkFactoryCascaderOptionsCache = null; // 请求异常时，清空缓存
      return [];
    } finally {
      // 请求完成后，无论成功或失败，都清除Promise引用，以便下次可以重新发起请求（如果需要）
      parkFactoryCascaderOptionsPromise = null;
    }
  })();

  return parkFactoryCascaderOptionsPromise;
}

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Cascader',
      componentProps: {
        changeOnSelect: false,
        expandTrigger: 'hover',
        fieldNames: {
          label: 'name',
          value: 'value',
          children: 'children',
        },
        options: [], // 数据将由 form.vue 动态填充
        placeholder: '请选择园区和厂房',
        style: { width: '100%' },
      },
      defaultValue: [],
      fieldName: 'factoryId', // 注意：此字段将持有数组值 [parkId, factoryId]
      label: $t('厂房名称'), // 修改为厂房名称
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'specifications',
      label: $t('system.maintenance.transformer.specifications'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.address'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'contact',
      label: $t('system.rental.contact'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          {
            label: $t('system.maintenance.transformer.status.normal'),
            value: '正常',
          },
          {
            label: $t('system.maintenance.transformer.status.abnormal'),
            value: '异常',
          },
          {
            label: $t('system.maintenance.transformer.status.maintenance'),
            value: '维护',
          },
        ],
        optionType: 'button',
      },
      defaultValue: '正常',
      fieldName: 'status',
      label: $t('system.maintenance.transformer.status.label'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'checkTime',
      label: $t('page.maintenance.checkTime'),
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
      fieldName: 'remark',
      label: $t('system.maintenance.transformer.remark'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [
            $t('system.maintenance.transformer.remark'),
            300,
          ]),
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
      component: 'Cascader', // 修改为 Cascader
      componentProps: {
        changeOnSelect: false,
        expandTrigger: 'hover',
        fieldNames: {
          label: 'name',
          value: 'value',
          children: 'children',
        },
        // options 将在 list.vue 中动态加载或通过 formApi 更新
        // 如果希望在 grid form 中也预加载，需要相应逻辑
        // 为简化，此处假设 options 会被 list.vue 中的逻辑处理或用户手动选择
        options: [],
        placeholder: '请选择园区和厂房',
        style: { width: '100%' },
      },
      fieldName: 'factoryId', // 对应厂房选择
      label: $t('厂房名称'), // 修改为厂房名称
    },
    {
      component: 'Input',
      fieldName: 'specifications',
      label: $t('system.maintenance.transformer.specifications'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: $t('system.maintenance.transformer.status.normal'),
            value: '正常',
          },
          {
            label: $t('system.maintenance.transformer.status.abnormal'),
            value: '异常',
          },
          {
            label: $t('system.maintenance.transformer.status.maintenance'),
            value: '维护',
          },
        ],
      },
      fieldName: 'status',
      label: $t('system.maintenance.transformer.status.label'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.address'),
    },
    {
      component: 'RangePicker',
      fieldName: 'checkTime',
      label: $t('page.maintenance.checkTime'),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = TransformerItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'factoryName', // 修改为 factoryName 或实际对应的厂房名字段
      minWidth: 150,
      title: $t('厂房名称'), // 修改表头为厂房名称
    },
    {
      field: 'specifications',
      minWidth: 120,
      title: $t('system.maintenance.transformer.specifications'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'status',
      minWidth: 100,
      title: $t('system.maintenance.transformer.status.label'),
    },
    {
      field: 'address',
      minWidth: 200,
      title: $t('system.rental.address'),
    },
    {
      field: 'contact',
      minWidth: 150,
      title: $t('system.rental.contact'),
    },
    {
      field: 'checkTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 120,
      title: $t('page.maintenance.checkTime'),
    },
    {
      field: 'remark',
      minWidth: 150,
      title: $t('system.maintenance.transformer.remark'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'transformerName',
          nameTitle: $t('system.maintenance.transformer.name'),
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
      title: $t('system.rental.operation'),
      width: 150,
    },
  ];
}
