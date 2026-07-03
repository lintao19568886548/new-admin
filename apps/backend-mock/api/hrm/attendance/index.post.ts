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
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  // 身份验证
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
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

    // 检查当天是否已经有打卡记录
    const startOfToday = dayjs(punchTime).startOf('day').toDate();
    const endOfToday = dayjs(punchTime).endOf('day').toDate();
    const existingRecord = await prismaClient.attendance.findFirst({
      where: {
        userId: userinfo.id,
        punchIn: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    if (existingRecord) {
      return useResponseError('今天已经打过上班卡了');
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

    const punchInMoment = dayjs(punchTime);
    const leaveMap = await getApprovedLeaveRangesByUserIds(
      [userinfo.id],
      punchInMoment.startOf('day').toDate(),
      punchInMoment.endOf('day').toDate(),
    );
    const { status } = await resolveAttendanceState({
      punchIn: new Date(punchTime),
      leaveRanges: leaveMap.get(userinfo.id) ?? [],
      phone: userinfo.phone,
      realName: userinfo.realName,
      userId: userinfo.id,
      username: userinfo.username,
    });

    const newAttendance = await prismaClient.attendance.create({
      data: {
        punchIn: new Date(punchTime),
        longitude: Number(longitude),
        latitude: Number(latitude),
        status,
        username: userinfo.realName,
        userId: userinfo.id,
      },
    });
    await recordAttendanceDeviceAbnormal({
      action: 'punch_in',
      attendanceId: newAttendance.attendanceId,
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
        attendanceId: newAttendance.attendanceId,
        decision: deviceDecision,
        punchTime,
        userId: userinfo.id,
      });
    }
    if (confirmOutsideRange && !locationConfirmationStatus.confirmedToday) {
      await createLocationAbnormalConfirmation({
        attendanceId: newAttendance.attendanceId,
        latitude,
        locationValidation,
        longitude,
        punchTime,
        userId: userinfo.id,
      });
    }

    return useResponseSuccess(newAttendance, '打卡成功');
  } catch (error: any) {
    if (error instanceof AttendanceDeviceError) {
      return useResponseError(error.message, {
        deviceStatus: error.deviceStatus,
        errorCode: error.errorCode,
      });
    }
    console.error('创建打卡记录失败:', error);
    return useResponseError(error.message || '创建失败');
  }
});
