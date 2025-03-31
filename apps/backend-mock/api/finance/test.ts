import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default eventHandler(async () => {
  // 插入财务数据
  const financeItems = [
    {
      financeId: 1,
      billName: '5月房租',
      billCategory: '房租',
      amount: 5000,
      transactionType: '支出',
      transactionTime: new Date('2023-05-01 10:00:00'),
    },
    {
      financeId: 2,
      billName: '4月水费',
      billCategory: '水费',
      amount: 320.5,
      transactionType: '支出',
      transactionTime: new Date('2023-04-25 14:30:00'),
    },
    {
      financeId: 3,
      billName: '4月电费',
      billCategory: '电费',
      amount: 750.8,
      transactionType: '支出',
      transactionTime: new Date('2023-04-26 09:15:00'),
    },
    {
      financeId: 4,
      billName: '厂房租赁收入',
      billCategory: '房租',
      amount: 12_000,
      transactionType: '收入',
      transactionTime: new Date('2023-05-05 11:20:00'),
    },
    {
      financeId: 5,
      billName: '设备维修费',
      billCategory: '其他费用',
      amount: 1500,
      transactionType: '支出',
      transactionTime: new Date('2023-05-10 16:45:00'),
    },
    {
      financeId: 6,
      billName: '燃气费',
      billCategory: '燃气费',
      amount: 422.3,
      transactionType: '支出',
      transactionTime: new Date('2023-05-12 10:30:00'),
    },
  ];

  // 使用 upsert 方法（更新或插入）
  for (const item of financeItems) {
    await prisma.finance.upsert({
      where: {
        financeId: item.financeId, // 使用数据库中的字段名
      },
      update: item,
      create: item,
    });
  }

  console.log('财务数据已成功录入');
  return useResponseSuccess('财务数据已成功录入');
});
