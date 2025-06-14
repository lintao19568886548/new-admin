import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// 获取所有请假申请
export const getAllLeaveApplications = async (req: Request, res: Response) => {
  try {
    const leaveApplications = await prisma.leaveApplication.findMany();
    res.json(leaveApplications);
  } catch {
    res.status(500).json({ error: '获取请假申请失败' });
  }
};

// 创建新的请假申请
export const createLeaveApplication = async (req: Request, res: Response) => {
  const { startDate, endDate, reason } = req.body;
  try {
    const newLeaveApplication = await prisma.leaveApplication.create({
      data: {
        startDate,
        endDate,
        reason,
      },
    });
    res.status(201).json(newLeaveApplication);
  } catch {
    res.status(500).json({ error: '创建请假申请失败' });
  }
};

// 更新请假申请状态
export const updateLeaveApplicationStatus = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updatedLeaveApplication = await prisma.leaveApplication.update({
      where: { id: Number.parseInt(id) },
      data: { status },
    });
    res.json(updatedLeaveApplication);
  } catch {
    res.status(500).json({ error: '更新请假申请状态失败' });
  }
};

// 删除请假申请
export const deleteLeaveApplication = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.leaveApplication.delete({
      where: { id: Number.parseInt(id) },
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: '删除请假申请失败' });
  }
};
