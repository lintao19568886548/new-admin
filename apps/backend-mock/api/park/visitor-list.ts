import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async () => {
  const allPark = await prismaClient.park.findMany({
    where: {
      isDeleted: false,
    },
    select: { parkId: true, parkName: true },
  });
  return useResponseSuccess(allPark);
});
