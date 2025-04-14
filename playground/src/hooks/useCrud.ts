import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { $t } from '#/locales';

/**
 * 通用CRUD操作钩子
 * @param options CRUD操作配置
 * @param options.createApi 创建实体的API函数
 * @param options.dataProcessor 数据预处理函数，在提交前处理数据
 * @param options.deleteApi 删除实体的API函数
 * @param options.entityName 实体名称，用于显示消息
 * @param options.formComponent 表单组件
 * @param options.idField 实体ID字段名
 * @param options.nameField 实体名称字段，用于显示在消息中
 * @param options.onSuccess 成功回调
 * @param options.refreshCallback 刷新列表的回调函数
 * @param options.updateApi 更新实体的API函数
 * @returns CRUD相关方法和状态
 */
export function useCrud<T extends Record<string, any>>(options: {
  // 创建实体的API函数
  createApi: (data: any) => Promise<any>;
  // 数据预处理函数，在提交前处理数据
  dataProcessor?: (data: any) => any;
  // 删除实体的API函数
  deleteApi: (id: number | string) => Promise<any>;
  // 实体名称，用于显示消息
  entityName: string;
  // 表单组件
  formComponent: any;
  // 实体ID字段名
  idField: string;
  // 实体名称字段，用于显示在消息中
  nameField: string;
  // 成功回调
  onSuccess?: () => void;
  // 刷新列表的回调函数
  refreshCallback: () => void;
  // 更新实体的API函数
  updateApi: (id: number | string, data: any) => Promise<any>;
}) {
  const {
    createApi,
    dataProcessor = (data) => data,
    deleteApi,
    entityName,
    formComponent,
    idField,
    nameField,
    onSuccess = () => {},
    refreshCallback,
    updateApi,
  } = options;

  // 表单模态框
  const [FormModal, formModalApi] = useVbenModal({
    connectedComponent: formComponent,
    destroyOnClose: true,
  });

  /**
   * 创建实体
   */
  function onCreate() {
    formModalApi.setData(null).open();
  }

  /**
   * 编辑实体
   */
  function onEdit(row: T) {
    formModalApi.setData(row).open();
  }

  /**
   * 查看实体详情
   */
  function onView(row: T) {
    formModalApi.setData({ ...row, readonly: true }).open();
  }

  /**
   * 删除实体
   */
  function onDelete(row: T) {
    const entityId = row[idField];
    const entityDisplayName = row[nameField];

    message.loading({
      content: $t('ui.actionMessage.deleting', [entityDisplayName]),
      duration: 0,
      key: 'action_process_msg',
    });

    deleteApi(entityId)
      .then(() => {
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [entityDisplayName]),
          key: 'action_process_msg',
        });
        refreshCallback();
        onSuccess();
      })
      .catch((error) => {
        console.error(`删除${entityName}失败:`, error);
        message.error({
          content: $t('ui.actionMessage.deleteFailed', [entityDisplayName]),
          key: 'action_process_msg',
        });
      });
  }

  /**
   * 处理表单提交
   */
  async function handleFormSubmit(values: any, id?: number | string) {
    const processedData = dataProcessor(values);

    try {
      if (id) {
        await updateApi(id, processedData);
        message.success({
          content: $t('ui.actionMessage.updateSuccess', [values[nameField]]),
        });
      } else {
        await createApi(processedData);
        message.success({
          content: $t('ui.actionMessage.createSuccess', [values[nameField]]),
        });
      }
      refreshCallback();
      onSuccess();
      return true;
    } catch (error) {
      console.error('操作失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [values[nameField]]),
      });
      return false;
    }
  }

  /**
   * 处理表格操作按钮点击
   */
  function onActionClick(e: { code: string; row: T }) {
    switch (e.code) {
      case 'delete': {
        onDelete(e.row);
        break;
      }
      case 'edit': {
        onEdit(e.row);
        break;
      }
      case 'view': {
        onView(e.row);
        break;
      }
    }
  }

  return {
    FormModal,
    formModalApi,
    handleFormSubmit,
    onActionClick,
    onCreate,
    onDelete,
    onEdit,
    onView,
  };
}
