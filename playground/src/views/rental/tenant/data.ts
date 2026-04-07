import type { RentalManagementItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { h, markRaw, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { z } from '#/adapter/form';
import { getParkList } from '#/api/park';
import { $t } from '#/locales';

import IncreaseForm from './modules/increase-form.vue';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const imageOnChange = (info: any) => {
  const { file } = info;
  if (file.status === 'done') {
    const imgId = file.response?.data?.imgId;
    if (imgId) {
      file.imgId = imgId;
    }
    const name = file.response?.data?.name || file.name;
    message.success(`${name} 上传成功`);
  } else if (file.status === 'error') {
    const errorMsg = file.response?.message || '上传失败';
    message.error(`${file.name} ${errorMsg}`);
    console.error('Upload Error Response:', file.response);
  }
};

const imageOnPreview = (file: any) => {
  const imageUrl =
    file.url ||
    file.thumbUrl ||
    file.response?.data?.thumbUrl ||
    file.response?.data?.url;
  if (imageUrl) {
    const image = new Image();
    image.src = imageUrl;
    const imgWindow = window.open('', '_blank');
    if (imgWindow) {
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
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'green',
      label: $t('system.rental.tenant.status.current'),
      value: 'active',
    },
    {
      color: 'red',
      label: $t('system.rental.tenant.status.expired'),
      value: 'expired',
    },
  ];
}

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'partyAName',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.partyAName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'partyAContactName',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.partyAContactName'),
    },
    {
      component: 'Input',
      fieldName: 'partyAContactPhone',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.partyAContactPhone'),
    },
    {
      component: 'Input',
      fieldName: 'partyBName',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.partyBName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'partyBContactName',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.partyBContactName'),
    },
    {
      component: 'Input',
      fieldName: 'partyBContactPhone',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.partyBContactPhone'),
      rules: 'required',
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        inputReadOnly: true,
        placeholder: ['开始日期', '结束日期'],
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'contractDate',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.contractDate'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.tenant.address'),
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getParkList,
        class: 'w-full',
        labelField: 'parkName',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('page.common.park'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/月',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'rent',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('page.common.rent'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '㎡',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'area',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('page.rental.area'),
    },
    {
      component: markRaw(IncreaseForm),
      componentProps: {
        style: { width: '100%' },
      },
      fieldName: 'increaseData', // 保持不变，已与接口一致
      formItemClass: 'col-span-full',
      // label: $t('page.rental.increaseData'),
    },
    {
      component: 'Upload',
      componentProps: {
        accept: '.png,.jpg,.jpeg',
        action: `${apiURL}/image/upload`,
        beforeUpload,
        headers: {
          Authorization: `Bearer ${accessStore.accessToken}`,
        },
        onChange: imageOnChange,
        onPreview: imageOnPreview,
        listType: 'picture-card',
      },
      fieldName: 'images',
      formItemClass: 'col-span-full',
      label: $t('page.factory.images'),
      renderComponentContent: () => ({
        default: () => $t('page.factory.upload-image'),
      }),
    },
    // {
    //   component: 'DatePicker',
    //   componentProps: {
    //     format: 'YYYY-MM-DD',
    //     placeholder: '请选择涨租日期',
    //     style: { width: '100%' },
    //     valueFormat: 'YYYY-MM-DD', // 简化日期格式
    //   },
    //   fieldName: 'increaseDate',
    //   label: $t('system.rental.tenant.increaseDate'),
    // },
    // {
    //   component: 'InputNumber',
    //   componentProps: {
    //     addonAfter: '%',
    //     precision: 2,
    //     style: { width: '100%' },
    //   },
    //   fieldName: 'increaseRate',
    //   label: $t('system.rental.tenant.increaseRate'),
    // },
    // {
    //   component: 'InputNumber',
    //   componentProps: {
    //     addonAfter: '‰',
    //     precision: 2,
    //     style: { width: '100%' },
    //   },
    //   fieldName: 'penaltyRate',
    //   label: $t('page.rental.penaltyRate'),
    // },

    // {
    //   component: 'RadioGroup',
    //   componentProps: {
    //     buttonStyle: 'solid',
    //     options: [
    //       { label: $t('system.rental.tenant.status.current'), value: '当期' },
    //       { label: $t('system.rental.tenant.status.expired'), value: '过期' },
    //     ],
    //     optionType: 'button',
    //   },
    //   defaultValue: '当期',
    //   fieldName: 'status',
    //   label: $t('system.rental.tenant.status.label'),
    // },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 200,
        rows: 4,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'remark',
      formItemClass: 'col-span-full',
      label: $t('page.common.remark'),
      rules: z
        .string()
        .max(
          200,
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
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getParkList,
        class: 'w-full',
        labelField: 'parkName',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      label: $t('page.common.park'),
    },
    {
      component: 'Input',
      fieldName: 'partyAName',
      label: $t('system.rental.tenant.partyAName'),
    },
    {
      component: 'Input',
      fieldName: 'partyBName',
      label: $t('system.rental.tenant.partyBName'),
    },
    {
      component: 'Input',
      fieldName: 'partyBContactPhone',
      label: $t('system.rental.tenant.partyBContactPhone'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.rental.tenant.status.current'), value: 'active' },
          {
            label: $t('system.rental.tenant.status.expired'),
            value: 'expired',
          },
        ],
      },
      fieldName: 'status',
      label: $t('system.rental.tenant.status.label'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'contractDate',
      label: $t('system.rental.tenant.contractDate'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD', // 指定输出格式
      },
      fieldName: 'increaseDate',
      label: $t('system.rental.tenant.increaseDate'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'increaseRate',
      label: $t('system.rental.tenant.increaseRate'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.tenant.address'),
    },
  ];
}

// 创建一个全局的选项数组，避免每次重新生成
const getIncreaseFormOptions = ref([
  { label: '无', value: '无' },
  { label: '一次递增', value: '1' },
  { label: '二次递增', value: '2' },
  { label: '三次递增', value: '3' },
]);

export function useIncreaseFormSchema(): VbenFormSchema[] {
  // 构建表单架构
  const formItems: VbenFormSchema[] = [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getIncreaseFormOptions,
      },
      defaultValue: '无',
      fieldName: 'increase',
      formItemClass: 'md:col-span-2',
      label: $t('system.rental.tenant.increase'),
    },
  ];

  // 添加所有可能的递增级别字段
  for (let i = 1; i <= 3; i++) {
    const level = i.toString();
    formItems.push(
      {
        component: 'InputNumber',
        componentProps: {
          addonAfter: '年',
        },
        dependencies: {
          show: (values) => {
            return values.increase === level;
          },
          triggerFields: ['increase'],
        },
        fieldName: `increaseDate_${i}`,
        label: $t('system.rental.tenant.increaseDate'),
      },
      {
        component: 'InputNumber',
        componentProps: {
          addonAfter: '%',
        },
        dependencies: {
          show: (values) => {
            return values.increase === level;
          },
          triggerFields: ['increase'],
        },
        fieldName: `increaseRate_${i}`,
        label: $t('system.rental.tenant.increaseRate'),
      },
    );
  }

  return formItems;
}

export function getPartyADisplayName(row: Partial<RentalManagementItem>) {
  return row.partyAName || row.partyA?.partyName || '';
}

export function getPartyAContactName(row: Partial<RentalManagementItem>) {
  return row.partyAContactName || row.partyA?.contactName || '';
}

export function getPartyAContactPhone(row: Partial<RentalManagementItem>) {
  return row.partyAContactPhone || row.partyA?.contactPhone || '';
}

export function getPartyBDisplayName(row: Partial<RentalManagementItem>) {
  return row.partyBName || row.partyB?.partyName || row.tenantName || '';
}

export function getPartyBContactName(row: Partial<RentalManagementItem>) {
  return row.partyBContactName || row.partyB?.contactName || '';
}

export function getPartyBContactPhone(row: Partial<RentalManagementItem>) {
  return (
    row.partyBContactPhone || row.partyB?.contactPhone || row.phoneNumber || ''
  );
}

/**
 * 格式化合同日期
 */
export function formatContractDateDisplay(row: {
  contractEnd?: string;
  contractStart?: string;
}) {
  const start = row.contractStart
    ? dayjs(row.contractStart).format('YYYY.MM.DD')
    : '';
  const end = row.contractEnd
    ? dayjs(row.contractEnd).format('YYYY.MM.DD')
    : '';

  if (!start && !end) return '';
  if (start && !end) return start;
  if (!start && end) return end;

  return `${start} - ${end}`;
}

/**
 * 格式化面积
 */
export function formatAreaDisplay(cellValue: number | string) {
  if (!cellValue) return '';
  return `${cellValue}㎡`;
}

/**
 * 格式化租金
 */
export function formatRentDisplay(cellValue: number | string) {
  if (!cellValue) return '';
  return `${cellValue}元/月`;
}

/**
 * 计算并格式化下一次增租日期
 */
export function calculateIncreaseDateDisplay(row: any): string {
  if (!row.increaseData || !row.contractStart) return '';

  try {
    // 解析增租数据
    const rowData =
      typeof row.increaseData === 'string'
        ? JSON.parse(row.increaseData)
        : row.increaseData;

    if (rowData.length <= 0) return '';

    // 获取当前时间
    const now = dayjs();
    // 合同开始时间
    const contractStart = dayjs(row.contractStart);
    // 合同结束时间
    const contractEnd = row.contractEnd ? dayjs(row.contractEnd) : null;

    // 如果只有一个递增元素
    if (rowData.length === 1) {
      const item = rowData[0];

      // 如果递增年数为0，直接返回特定提示，避免无限循环
      if (item.date === 0) {
        return '';
      }

      let nextIncreaseDate;
      let years = item.date;

      // 循环计算，直到找到大于当前时间的递增日期
      while (true) {
        nextIncreaseDate = contractStart.add(years, 'year');

        // 如果大于当前时间，检查是否也大于合同结束时间
        if (nextIncreaseDate.isAfter(now)) {
          if (contractEnd && nextIncreaseDate.isAfter(contractEnd)) {
            return nextIncreaseDate.format('YYYY-MM-DD');
          }
          return nextIncreaseDate.format('YYYY-MM-DD');
        }

        // 继续计算下一个递增日期（每次增加相同的年数）
        years += item.date;

        // 避免无限循环
        if (years > 100 || item.date === 0) {
          return '';
        }
      }
    }
    // 如果有多个递增元素
    else {
      // 解析增租数据，过滤掉递增年数为0的项
      let validRowData = [...rowData];

      // 检查是否存在递增年数为0的情况
      if (validRowData.some((item: any) => item.date === 0)) {
        // 找到所有递增年数大于0的项目
        validRowData = validRowData.filter((item: any) => item.date > 0);

        // 如果没有有效的递增项，返回最后一个递增率
        if (validRowData.length === 0) {
          return `${rowData[rowData.length - 1].rate}%`;
        }
      }

      // 计算初始递增周期
      let currentDate = contractStart;
      let nextDates: dayjs.Dayjs[] = [];
      const rateMap: Record<string, number> = {}; // 用于保存日期对应的递增率

      // 先计算基础递增周期内的所有递增日期
      for (const item of validRowData) {
        currentDate = currentDate.add(item.date, 'year');
        nextDates.push(currentDate);
        // 保存这个日期对应的递增率
        rateMap[currentDate.format('YYYY-MM-DD')] = item.rate;
      }

      // 获取基础周期的总年数
      const totalYears = validRowData.reduce(
        (sum: number, item: any) => sum + item.date,
        0,
      );

      // 从基础周期开始，循环计算后续递增日期
      const lastDate = nextDates[nextDates.length - 1];

      if (!lastDate) {
        return ''; // 防止未定义错误
      }

      // 如果基础周期内的最后一个日期已经大于当前时间，则直接在基础周期内寻找
      if (lastDate.isAfter(now)) {
        for (const date of nextDates) {
          if (date && date.isAfter(now)) {
            // 检查是否大于合同结束时间
            if (contractEnd && date.isAfter(contractEnd)) {
              // 返回"已过期"提示
              return '已过期';
            }
            // 返回对应的递增日期
            return date.format('YYYY-MM-DD');
          }
        }
      }

      // 计算后续周期的递增日期
      let currentCycleCount = 1;
      while (currentCycleCount < 10) {
        // 限制最多10个周期，避免无限循环
        const newDates: dayjs.Dayjs[] = [];
        for (const date of nextDates) {
          if (date) {
            newDates.push(date.add(totalYears, 'year'));
          }
        }

        // 更新nextDates为新计算的日期
        nextDates = newDates;

        // 检查这个周期内的日期
        for (const date of nextDates) {
          if (date && date.isAfter(now)) {
            // 检查是否大于合同结束时间
            if (contractEnd && date.isAfter(contractEnd)) {
              // 返回"已过期"提示
              return '已过期';
            }
            // 返回对应的递增日期
            return date.format('YYYY-MM-DD');
          }
        }

        currentCycleCount++;
      }

      // 如果10个周期内都没找到，返回已递增状态
      return '已递增';
    }
  } catch (error) {
    console.error('计算递增日期失败:', error);
    return '';
  }
}

/**
 * 计算并格式化下一次增租率
 */
export function calculateIncreaseRateDisplay(row: any): string {
  if (!row.increaseData || !row.contractStart) return '';

  try {
    // 解析增租数据
    const rowData =
      typeof row.increaseData === 'string'
        ? JSON.parse(row.increaseData)
        : row.increaseData;

    if (rowData.length <= 0) return '';

    // 获取当前时间
    const now = dayjs();
    // 合同开始时间
    const contractStart = dayjs(row.contractStart);
    // 合同结束时间
    const contractEnd = row.contractEnd ? dayjs(row.contractEnd) : null;

    // 如果只有一个递增元素
    if (rowData.length === 1) {
      const item = rowData[0];

      // 如果递增年数为0，直接返回增租率，避免无限循环
      if (item.date === 0) {
        return `${item.rate}%`;
      }

      let nextIncreaseDate;
      let years = item.date;

      // 循环计算，直到找到大于当前时间的递增日期
      while (true) {
        nextIncreaseDate = contractStart.add(years, 'year');

        // 如果大于当前时间，检查是否也大于合同结束时间
        if (nextIncreaseDate.isAfter(now)) {
          if (contractEnd && nextIncreaseDate.isAfter(contractEnd)) {
            return `${item.rate}%`;
          }
          return `${item.rate}%`;
        }

        // 继续计算下一个递增日期（每次增加相同的年数）
        years += item.date;

        // 避免无限循环
        if (years > 100 || item.date === 0) {
          return `${item.rate}%`;
        }
      }
    }
    // 如果有多个递增元素
    else {
      // 解析增租数据，过滤掉递增年数为0的项
      let validRowData = [...rowData];

      // 检查是否存在递增年数为0的情况
      if (validRowData.some((item: any) => item.date === 0)) {
        // 找到所有递增年数大于0的项目
        validRowData = validRowData.filter((item: any) => item.date > 0);

        // 如果没有有效的递增项，返回最后一个递增率
        if (validRowData.length === 0) {
          return `${rowData[rowData.length - 1].rate}%`;
        }
      }

      // 计算初始递增周期
      let currentDate = contractStart;
      let nextDates: dayjs.Dayjs[] = [];
      const rateMap: Record<string, number> = {}; // 用于保存日期对应的递增率

      // 先计算基础递增周期内的所有递增日期
      for (const item of validRowData) {
        currentDate = currentDate.add(item.date, 'year');
        nextDates.push(currentDate);
        // 保存这个日期对应的递增率
        rateMap[currentDate.format('YYYY-MM-DD')] = item.rate;
      }

      // 获取基础周期的总年数
      const totalYears = validRowData.reduce(
        (sum: number, item: any) => sum + item.date,
        0,
      );

      // 从基础周期开始，循环计算后续递增日期
      const lastDate = nextDates[nextDates.length - 1];

      if (!lastDate) {
        return ''; // 防止未定义错误
      }

      // 如果基础周期内的最后一个日期已经大于当前时间，则直接在基础周期内寻找
      if (lastDate.isAfter(now)) {
        for (const [i, date] of nextDates.entries()) {
          if (date && date.isAfter(now)) {
            // 检查是否大于合同结束时间
            if (contractEnd && date.isAfter(contractEnd)) {
              // 返回最后一个递增率
              return `${validRowData[validRowData.length - 1].rate}%`;
            }
            // 返回对应的递增率
            if (i < validRowData.length) {
              return `${validRowData[i].rate}%`;
            }
            return `${validRowData[validRowData.length - 1].rate}%`;
          }
        }
      }

      // 计算后续周期的递增日期
      let currentCycleCount = 1;
      while (currentCycleCount < 10) {
        // 限制最多10个周期，避免无限循环
        const newDates: dayjs.Dayjs[] = [];
        for (const date of nextDates) {
          if (date) {
            newDates.push(date.add(totalYears, 'year'));
          }
        }

        // 更新nextDates为新计算的日期
        nextDates = newDates;

        // 检查这个周期内的日期
        for (const [i, date] of nextDates.entries()) {
          if (date && date.isAfter(now)) {
            // 检查是否大于合同结束时间
            if (contractEnd && date.isAfter(contractEnd)) {
              // 返回最后一个递增率
              return `${validRowData[validRowData.length - 1].rate}%`;
            }
            // 返回对应的递增率
            if (i < validRowData.length) {
              return `${validRowData[i].rate}%`;
            }
            return `${validRowData[validRowData.length - 1].rate}%`;
          }
        }

        currentCycleCount++;
      }

      // 如果10个周期内都没找到，返回最后一个递增率
      return `${validRowData[validRowData.length - 1].rate}%`;
    }
  } catch (error) {
    console.error('计算递增率失败:', error);
    return '';
  }
}

/**
 * 获取表格列配置
 */
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'partyAName',
      minWidth: 150,
      slots: {
        default: ({ row }) => getPartyADisplayName(row) || '--',
      },
      title: $t('system.rental.tenant.partyAName'),
    },
    {
      field: 'partyBName',
      minWidth: 150,
      slots: {
        default: ({ row }) => getPartyBDisplayName(row) || '--',
      },
      title: $t('system.rental.tenant.partyBName'),
    },
    {
      field: 'partyBContactPhone',
      slots: {
        default: ({ row }) => getPartyBContactPhone(row) || '--',
      },
      title: $t('system.rental.tenant.partyBContactPhone'),
      width: 140,
    },
    // {
    //   cellRender: {
    //     name: 'CellTag',
    //     options: getTagTypeOptions(),
    //   },
    //   field: 'status',
    //   minWidth: 80,
    //   title: $t('system.rental.tenant.status.label'),
    // },
    {
      field: 'status',
      slots: {
        default: ({ row }) => {
          const isExpired = row.contractEnd
            ? dayjs().isAfter(dayjs(row.contractEnd))
            : false;
          const status = isExpired ? '过期' : '生效中';
          const option = getTagTypeOptions().find(
            (opt) => opt.label === status,
          );
          return h(Tag, { color: option?.color }, () => status);
        },
      },
      title: $t('system.rental.tenant.status.label'),
      width: 100,
    },
    {
      field: 'contractDate',
      slots: {
        default: ({ row }) => formatContractDateDisplay(row),
      },
      title: $t('system.rental.tenant.contractDate'),
      width: 160,
    },
    {
      field: 'area',
      slots: {
        default: ({ row }) => formatAreaDisplay(row.area),
      },
      title: $t('page.rental.area'),
      width: 120,
    },
    {
      field: 'rent',
      slots: {
        default: ({ row }) => formatRentDisplay(row.rent),
      },
      title: $t('page.common.rent'),
      width: 120,
    },
    {
      field: 'increaseDate',
      slots: {
        default: ({ row }) => calculateIncreaseDateDisplay(row),
      },
      title: $t('system.rental.tenant.increaseDate'),
      width: 130,
    },
    {
      field: 'increaseRate',
      slots: {
        default: ({ row }) => calculateIncreaseRateDisplay(row),
      },
      title: $t('system.rental.tenant.increaseRate'),
      width: 80,
    },
    {
      field: 'address',
      minWidth: 180,
      title: $t('system.rental.tenant.address'),
    },
    {
      field: 'sendMessage',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '未发送';
        return dayjs(cellValue).format('YYYY-MM-DD HH:mm');
      },
      title: '上次发送短信',
      width: 140,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'partyBName',
          nameTitle: $t('system.rental.tenant.partyBName'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
          'edit', // 默认的编辑按钮
          {
            code: 'sms',
            text: '发短信',
          },
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
