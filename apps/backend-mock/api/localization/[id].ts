import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  const localization = await prismaClient.localization.findUnique({
    where: {
      localizationId: id,
    },
  });

  if (!localization) {
    return useResponseError('记录不存在');
  }

  return useResponseSuccess(localization, '获取成功');
});
