import { requestClient } from '#/api/request';

export async function getCarList(params?: any) {
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

  // 特殊处理日期范围参数
  if (cleanParams.registerTime && Array.isArray(cleanParams.registerTime)) {
    // 将日期数组转换为逗号分隔的字符串
    cleanParams.registerTime = cleanParams.registerTime.join(',');
  }

  // 过滤掉 undefined 的值
  const filteredParams = Object.fromEntries(
    Object.entries(cleanParams).filter(([_, value]) => value !== undefined),
  );

  return requestClient
    .get('/access/car/list', {
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

export async function updateCar(id: number, data: any) {
  // 确保数据格式正确
  const submitData = { ...data };

  // 处理日期格式
  if (submitData.registerTime && typeof submitData.registerTime === 'string') {
    submitData.registerTime = new Date(submitData.registerTime);
  }

  console.warn('更新访客数据:', id, submitData);

  return requestClient.put(`/access/car/${id}`, submitData);
}

export async function createCar(data: any) {
  // 确保数据格式正确
  const submitData = { ...data };

  // 处理日期格式
  if (submitData.registerTime && typeof submitData.registerTime === 'string') {
    submitData.registerTime = new Date(submitData.registerTime);
  }

  console.warn('创建访客数据:', submitData);

  return requestClient.post('/access/car', submitData);
}

export async function getCarDetail(id: number) {
  return requestClient.get(`/access/car/${id}`);
}

export async function deleteCar(id: number) {
  return requestClient.delete(`/access/car/${id}`);
}
