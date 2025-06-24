import dayjs from 'dayjs';
import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  try {
    const { punchTime, longitude, latitude } = await readBody(event);

    const existingAttendance = await prismaClient.attendance.findUnique({
      where: { attendanceId: id },
    });

    if (!existingAttendance) {
      return useResponseError('找不到该打卡记录');
    }

    const dataToUpdate: {
      latitude?: number;
      longitude?: number;
      punchOut?: Date;
      status?: number;
    } = {};

    if (punchTime) dataToUpdate.punchOut = new Date(punchTime);
    if (longitude !== undefined) dataToUpdate.longitude = longitude;
    if (latitude !== undefined) dataToUpdate.latitude = latitude;

    // 更新状态：如果下班时间早于18:00，则标记为早退
    const standardPunchOutTime = dayjs(punchTime).startOf('day').hour(18);
    const isEarlyLeave = dayjs(punchTime).isBefore(standardPunchOutTime);

    if (isEarlyLeave) {
      // 0:正常, 1:迟到, 2:早退, 3:迟到且早退
      dataToUpdate.status = existingAttendance.status === 1 ? 3 : 2;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return useResponseError('没有提供需要更新的数据');
    }

    const updatedAttendance = await prismaClient.attendance.update({
      where: { attendanceId: id },
      data: dataToUpdate,
    });

    return useResponseSuccess(updatedAttendance, '更新成功');
  } catch (error: any) {
    console.error('更新打卡记录失败:', error);
    return useResponseError(error.message || '更新失败');
  }
});
