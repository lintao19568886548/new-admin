import { requestClient } from '#/api/request';

export async function getVisitorList(params?: any) {
  console.warn('API调用参数:', params);

  // 处理查询参数，移除空值
  const cleanParams: Record<string, any> = { ...params };
  Object.keys(cleanParams).forEach((key) => {
    if (
      cleanParams[key] === undefined ||
      cleanParams[key] === null ||
      cleanParams[key] === ''
    ) {
      cleanParams[key] = undefined;
    }
  });

  // 确保日期范围参数格式正确
  if (
    cleanParams.registerTime &&
    typeof cleanParams.registerTime === 'string'
  ) {
    // 已经是字符串格式，不需要额外处理
    console.warn('日期范围参数:', cleanParams.registerTime);
  }

  // 过滤掉 undefined 的值
  const filteredParams = Object.fromEntries(
    Object.entries(cleanParams).filter(([_, value]) => value !== undefined),
  );

  return requestClient
    .get('/access/visitor/list', {
      params: filteredParams,
    })
    .then((response) => {
      // 确保返回的数据格式一致，包含分页信息
      if (response && !response.items) {
        // 如果返回的是数组，转换为标准格式
        return {
          currentPage: params?.currentPage || 1,
          pageSize: params?.pageSize || 20,
          total: Array.isArray(response) ? response.length : 0,
          items: Array.isArray(response) ? response : [],
        };
      }
      return response;
    });
}

export async function updateVisitor(id: number, data: any) {
  // 确保数据格式正确
  const submitData = { ...data };

  // 处理日期格式
  if (submitData.registerTime && typeof submitData.registerTime === 'string') {
    submitData.registerTime = new Date(submitData.registerTime);
  }

  console.warn('更新访客数据:', id, submitData);

  return requestClient.put(`/access/visitor/${id}`, submitData);
}

export async function createVisitor(data: any) {
  // 确保数据格式正确
  const submitData = { ...data };

  // 处理日期格式
  if (submitData.registerTime && typeof submitData.registerTime === 'string') {
    submitData.registerTime = new Date(submitData.registerTime);
  }

  console.warn('创建访客数据:', submitData);

  return requestClient.post('/access/visitor', submitData);
}

export async function getVisitorDetail(id: number) {
  return requestClient.get(`/access/visitor/${id}`);
}

export async function deleteVisitor(id: number) {
  return requestClient.delete(`/access/visitor/${id}`);
}
