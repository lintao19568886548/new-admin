import dayjs from 'dayjs';
import { readBody } from 'h3';
import {
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import {
  createDeviceAbnormalConfirmations,
  createLocationAbnormalConfirmation,
  getDeviceAbnormalConfirmationStatus,
  getLocationAbnormalConfirmationStatus,
  hasUnconfirmedDeviceAbnormalConfirmation,
} from '~/utils/attendance-abnormal-confirmation';
import {
  AttendanceDeviceError,
  getAttendanceDeviceStatus,
  prepareAttendanceDeviceForPunch,
  recordAttendanceDeviceAbnormal,
} from '~/utils/attendance-device';
import { validateAttendanceLocation } from '~/utils/attendance-location';
import { normalizeBoolean } from '~/utils/boolean';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return useResponseError('未登录或登录已过期', { statusCode: 401 });
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  try {
    const {
      punchTime,
      longitude,
      latitude,
      device,
      bindCurrentDevice: rawBindCurrentDevice,
      confirmDeviceAbnormal: rawConfirmDeviceAbnormal,
      confirmOutsideRange: rawConfirmOutsideRange,
    } = await readBody(event);
    const bindCurrentDevice = normalizeBoolean(rawBindCurrentDevice);
    const confirmDeviceAbnormal = normalizeBoolean(rawConfirmDeviceAbnormal);
    const confirmOutsideRange = normalizeBoolean(rawConfirmOutsideRange);

    if (!punchTime || longitude === undefined || latitude === undefined) {
      return useResponseError('缺少必要的参数');
    }

    const locationValidation = validateAttendanceLocation({
      latitude,
      longitude,
    });
    if (!locationValidation.isValid) {
      return useResponseError('定位失败，请开启定位权限后重新打卡');
    }

    const locationConfirmationStatus =
      await getLocationAbnormalConfirmationStatus({
        latitude,
        locationValidation,
        longitude,
        punchTime,
        userId: userinfo.id,
      });
    const canAllowOutsideRange =
      confirmOutsideRange || locationConfirmationStatus.confirmedToday;
    if (!locationValidation.inRange && !canAllowOutsideRange) {
      return useResponseError('当前位置不在打卡范围内，请确认后再打卡');
    }

    const existingAttendance = await prismaClient.attendance.findUnique({
      where: { attendanceId: id },
    });

    if (!existingAttendance) {
      return useResponseError('找不到该打卡记录');
    }

    const roleNames = userinfo.roles ?? [];
    const isSuper = roleNames.includes('Super');
    if (!isSuper && existingAttendance.userId !== userinfo.id) {
      return useResponseError('没有权限修改他人考勤记录', { statusCode: 403 });
    }

    const initialDeviceDecision = await getAttendanceDeviceStatus({
      deviceInput: device,
      user: userinfo,
    });
    const deviceConfirmationStatus =
      initialDeviceDecision.status === 'abnormal'
        ? await getDeviceAbnormalConfirmationStatus({
            decision: initialDeviceDecision,
            punchTime,
            userId: userinfo.id,
          })
        : null;
    const deviceDecision = await prepareAttendanceDeviceForPunch({
      allowDeviceAbnormal:
        confirmDeviceAbnormal || deviceConfirmationStatus?.confirmedToday,
      bindCurrentDevice,
      deviceInput: device,
      preparedDecision: initialDeviceDecision,
      user: userinfo,
    });

    const punchOutMoment = dayjs(punchTime);
    const leaveMap = await getApprovedLeaveRangesByUserIds(
      existingAttendance.userId ? [existingAttendance.userId] : [],
      punchOutMoment.startOf('day').toDate(),
      punchOutMoment.endOf('day').toDate(),
    );
    const attendanceUser = existingAttendance.userId
      ? await prismaClient.user.findUnique({
          where: {
            id: existingAttendance.userId,
          },
          select: {
            phone: true,
            realName: true,
            username: true,
          },
        })
      : null;
    let fallbackRealName: string | undefined;
    let fallbackUsername: string | undefined;

    if (existingAttendance.userId) {
      if (existingAttendance.userId === userinfo.id) {
        fallbackRealName = userinfo.realName;
        fallbackUsername = userinfo.username;
      }
    } else {
      fallbackRealName = existingAttendance.username;
      fallbackUsername = existingAttendance.username;
    }
    const { status } = await resolveAttendanceState({
      punchIn: existingAttendance.punchIn,
      punchOut: new Date(punchTime),
      leaveRanges: existingAttendance.userId
        ? (leaveMap.get(existingAttendance.userId) ?? [])
        : [],
      phone:
        attendanceUser?.phone ||
        (existingAttendance.userId === userinfo.id
          ? userinfo.phone
          : undefined),
      realName: attendanceUser?.realName || fallbackRealName,
      userId: existingAttendance.userId ?? userinfo.id,
      username: attendanceUser?.username || fallbackUsername,
    });

    const updatedAttendance = await prismaClient.attendance.update({
      where: { attendanceId: id },
      data: {
        punchOut: new Date(punchTime),
        latitude: Number(latitude),
        longitude: Number(longitude),
        status,
      },
    });

    await recordAttendanceDeviceAbnormal({
      action: 'punch_out',
      attendanceId: updatedAttendance.attendanceId,
      decision: deviceDecision,
      punchTime: new Date(punchTime),
      user: userinfo,
    });
    if (
      confirmDeviceAbnormal &&
      hasUnconfirmedDeviceAbnormalConfirmation(deviceConfirmationStatus)
    ) {
      await createDeviceAbnormalConfirmations({
        abnormalTypes: deviceConfirmationStatus?.unconfirmedAbnormalTypes,
        attendanceId: updatedAttendance.attendanceId,
        decision: deviceDecision,
        punchTime,
        userId: userinfo.id,
      });
    }
    if (confirmOutsideRange && !locationConfirmationStatus.confirmedToday) {
      await createLocationAbnormalConfirmation({
        attendanceId: updatedAttendance.attendanceId,
        latitude,
        locationValidation,
        longitude,
        punchTime,
        userId: userinfo.id,
      });
    }

    return useResponseSuccess(updatedAttendance, '更新成功');
  } catch (error: any) {
    if (error instanceof AttendanceDeviceError) {
      return useResponseError(error.message, {
        deviceStatus: error.deviceStatus,
        errorCode: error.errorCode,
      });
    }
    console.error('更新打卡记录失败:', error);
    return useResponseError(error.message || '更新失败');
  }
});
