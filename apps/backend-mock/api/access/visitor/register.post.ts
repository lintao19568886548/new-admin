import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // 验证必填字段
    if (!body.visitorName) {
      return useResponseError('姓名不能为空', 400);
    }

    if (!body.phoneNumber || !/^1[3-9]\d{9}$/.test(body.phoneNumber)) {
      return useResponseError('请输入正确的手机号码', 400);
    }

    if (body.status === undefined || body.status === null) {
      return useResponseError('访问状态不能为空', 400);
    }

    // 确保状态值为数字类型
    if (typeof body.status === 'string') {
      if (body.status === '进入') {
        body.status = 0;
      } else if (body.status === '离开') {
        body.status = 1;
      }
    }

    // 设置默认的登记时间（如果未提供）
    if (!body.registerTime) {
      body.registerTime = new Date();
    } else if (typeof body.registerTime === 'string') {
      body.registerTime = new Date(body.registerTime);
    }

    // 创建访客记录
    const accessVisitor = await prismaClient.accessVisitor.create({
      data: {
        visitorName: body.visitorName,
        phoneNumber: body.phoneNumber,
        carNum: body.carNum || null,
        remark: body.remark || null,
        status: body.status,
        registerTime: body.registerTime,
      },
    });

    return useResponseSuccess({
      success: true,
      message: '访客登记成功',
      data: accessVisitor,
    });
  } catch (error) {
    console.error('创建访客信息失败:', error);
    return useResponseError('创建访客信息失败', 500);
  }
});
