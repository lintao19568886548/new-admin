import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async () => {
  const allPark = await prismaClient.park.findMany({
    select: { parkId: true, parkName: true },
  });
  return useResponseSuccess(allPark);
});
