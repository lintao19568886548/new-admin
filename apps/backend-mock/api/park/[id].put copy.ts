import {
  Dormitory,
  Factory,
  FactoryFloor,
} from '@prisma/.prisma/client/index.js';
import { useResponseError } from '~/utils/response';

interface FactoryDomain extends Factory {
  floors?: FactoryFloor[];
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const parkId = Number.parseInt(event.context.params.id);
  if (!parkId) {
    return useResponseError('id不能为空');
  }

  const body = await readBody(event);
  const { factories, dormitories, ...park } = body;
  try {
    // 使用事务处理更新操作
    const res = await prismaClient.$transaction(async (prisma) => {
      // 更新园区信息
      await prisma.park.update({
        where: {
          parkId,
        },
        data: {
          ...park,
        },
      });

      // 获取园区下的所有工厂
      const existFactories = await prisma.factory.findMany({
        where: {
          parkId,
        },
      });

      // 计算需要删除的工厂和需要添加的工厂
      const deletedFactories = existFactories.filter(
        (factory) => !factories.includes(factory.factoryId),
      );

      const addedFactories = [];
      const updatedFactories = [];
      for (const factory of factories) {
        const existFactory = existFactories.find(
          (f) => f.factoryId === factory.factoryId,
        );
        if (existFactory) {
          updatedFactories.push(factory);
        } else {
          addedFactories.push(factory);
        }
      }
      createFactory(prisma, addedFactories);
      updateFactory(prisma, updatedFactories);
      deleteFactory(prisma, deletedFactories);

      // 获取园区下的所有宿舍
      const existDormitories = await prisma.dormitory.findMany({
        where: {
          parkId,
        },
      });
      // 计算需要删除的宿舍和需要添加的宿舍
      const deletedDormitories = existDormitories.filter(
        (dormitory) => !dormitories.includes(dormitory.dormitoryId),
      );
      const addedDormitories = [];
      const updatedDormitories = [];
      for (const dormitory of dormitories) {
        const existDormitory = existDormitories.find(
          (d) => d.dormitoryId === dormitory.dormitoryId,
        );
        if (existDormitory) {
          updatedDormitories.push(dormitory);
        } else {
          addedDormitories.push(dormitory);
        }
      }
      createDormitory(prisma, addedDormitories);
      updateDormitory(prisma, updatedDormitories);
      deleteDormitory(prisma, deletedDormitories);
    });
    return res;
  } catch (error) {
    return useResponseError(error, 500);
  }
});

async function createFactory(
  prisma: PrismaTransactionClient,
  factories: FactoryDomain[],
) {
  for (const item of factories) {
    const { floors, ...factory } = item;
    const newFactory = await prisma.factory.create({
      data: {
        ...factory,
        parkId: factory.parkId,
      },
    });
    createFactoryFloor(prisma, newFactory.factoryId, floors);
  }
}

async function updateFactory(
  prisma: PrismaTransactionClient,
  factories: Factory[],
) {
  for (const factory of factories) {
    await prisma.factory.update({
      where: {
        factoryId: factory.factoryId,
      },
      data: {
        ...factory,
        isDeleted: false,
      },
    });
  }
}

async function createFactoryFloor(
  prisma: PrismaTransactionClient,
  factoryId: number,
  floors: FactoryFloor[],
) {
  prisma.factoryFloor.createMany({
    data: floors.map((item) => ({
      ...item,
      factoryId,
    })),
  });
}

async function deleteFactory(
  prisma: PrismaTransactionClient,
  factories: Factory[],
) {
  for (const factory of factories) {
    await prisma.factory.update({
      where: {
        factoryId: factory.factoryId,
      },
      data: {
        isDeleted: true,
      },
    });
  }
}

async function createDormitory(
  prisma: PrismaTransactionClient,
  dormitories: Dormitory[],
) {
  prisma.dormitory.createMany({
    data: dormitories,
  });
}

async function updateDormitory(
  prisma: PrismaTransactionClient,
  dormitories: Dormitory[],
) {
  for (const dormitory of dormitories) {
    await prisma.dormitory.update({
      where: {
        dormitoryId: dormitory.dormitoryId,
      },
      data: {
        ...dormitory,
      },
    });
  }
}

async function deleteDormitory(
  prisma: PrismaTransactionClient,
  dormitories: Dormitory[],
) {
  for (const dormitory of dormitories) {
    await prisma.dormitory.update({
      where: {
        dormitoryId: dormitory.dormitoryId,
      },
      data: {
        isDeleted: true,
      },
    });
  }
}
