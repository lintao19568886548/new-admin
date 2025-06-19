import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  try {
    await prismaClient.localization.delete({
      where: {
        localizationId: id,
      },
    });
    return useResponseSuccess(null, '删除成功');
  } catch (error: any) {
    console.error('删除打卡记录失败:', error);
    return useResponseError(error.message || '删除失败');
  }
});
