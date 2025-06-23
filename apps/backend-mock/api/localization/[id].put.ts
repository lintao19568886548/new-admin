import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  try {
    const { punchTime, status, longitude, latitude } = await readBody(event);

    const dataToUpdate: {
      latitude?: number;
      longitude?: number;
      punchTime?: Date;
      status?: number;
    } = {};

    if (punchTime) dataToUpdate.punchTime = new Date(punchTime);
    if (status !== undefined) dataToUpdate.status = Number(status);
    if (longitude !== undefined) dataToUpdate.longitude = longitude;
    if (latitude !== undefined) dataToUpdate.latitude = latitude;

    if (Object.keys(dataToUpdate).length === 0) {
      return useResponseError('没有提供需要更新的数据');
    }

    const updatedLocalization = await prismaClient.localization.update({
      where: { localizationId: id },
      data: dataToUpdate,
    });

    return useResponseSuccess(updatedLocalization, '更新成功');
  } catch (error: any) {
    console.error('更新打卡记录失败:', error);
    return useResponseError(error.message || '更新失败');
  }
});
