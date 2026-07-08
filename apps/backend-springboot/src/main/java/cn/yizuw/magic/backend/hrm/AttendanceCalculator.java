package cn.yizuw.magic.backend.hrm;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 考勤状态和请假时长计算工具。
 *
 * <p>这里按旧后端 `utils/attendance.ts` 的口径迁移：请假分钟按 09:00-12:00、14:00-18:00
 * 两段工作时间计算；迟到/早退按员工排班时间或默认 09:00-18:00 判断。
 */
final class AttendanceCalculator {

  static final int STATUS_NORMAL = 0;
  static final int STATUS_LATE = 1;
  static final int STATUS_EARLY_LEAVE = 2;
  static final int STATUS_LATE_AND_EARLY_LEAVE = 3;
  static final String LEAVE_SCOPE_FULL = "full";
  static final String LEAVE_SCOPE_NONE = "none";
  static final String LEAVE_SCOPE_PARTIAL = "partial";
  static final LocalTime DEFAULT_CHECK_IN = LocalTime.of(9, 0);
  static final LocalTime DEFAULT_CHECK_OUT = LocalTime.of(18, 0);

  private AttendanceCalculator() {}

  /** 计算单条考勤记录在其打卡日期内的迟到、早退和请假摘要。 */
  static AttendanceState resolveState(
      LocalDateTime punchIn,
      LocalDateTime punchOut,
      List<TimeRange> leaveRanges,
      AttendanceSchedule schedule) {
    LocalDate day = punchIn.toLocalDate();
    List<TimeRange> normalizedLeaveRanges = normalizeRanges(leaveRanges);
    DailyLeaveSummary leaveSummary = dailyLeaveSummary(day, normalizedLeaveRanges);
    TimeRange scheduleRange =
        new TimeRange(
            day.atTime(schedule.checkInOrDefault()), day.atTime(schedule.checkOutOrDefault()));
    if (!scheduleRange.isValid()) {
      scheduleRange = new TimeRange(day.atTime(DEFAULT_CHECK_IN), day.atTime(DEFAULT_CHECK_OUT));
    }

    List<TimeRange> requiredSegments = subtractRange(scheduleRange, normalizedLeaveRanges);
    int status = STATUS_NORMAL;

    if (!requiredSegments.isEmpty() && punchIn.isAfter(requiredSegments.get(0).start())) {
      status = STATUS_LATE;
    }
    if (!requiredSegments.isEmpty()
        && punchOut != null
        && punchOut.isBefore(requiredSegments.get(requiredSegments.size() - 1).end())) {
      status = status == STATUS_LATE ? STATUS_LATE_AND_EARLY_LEAVE : STATUS_EARLY_LEAVE;
    }

    return new AttendanceState(leaveSummary.leaveMinutes(), leaveSummary.leaveScope(), status);
  }

  /** 按旧接口统计请假天数：上午、下午工作段各算 0.5 天。 */
  static double calculateApprovedLeaveDaysInRange(
      List<TimeRange> leaveRanges, LocalDateTime rangeStart, LocalDateTime rangeEnd) {
    if (rangeEnd == null || rangeStart == null || !rangeEnd.isAfter(rangeStart)) {
      return 0;
    }
    List<TimeRange> normalizedLeaveRanges = normalizeRanges(leaveRanges);
    double totalLeaveDays = 0;
    LocalDate cursor = rangeStart.toLocalDate();
    LocalDate lastDay = rangeEnd.toLocalDate();
    TimeRange queryRange = new TimeRange(rangeStart, rangeEnd);

    while (!cursor.isAfter(lastDay)) {
      for (TimeRange interval : buildWorkIntervals(cursor)) {
        TimeRange clipped = interval.intersect(queryRange);
        if (clipped == null) {
          continue;
        }
        boolean hasApprovedLeave =
            normalizedLeaveRanges.stream().anyMatch(range -> range.intersect(clipped) != null);
        if (hasApprovedLeave) {
          totalLeaveDays += 0.5;
        }
      }
      cursor = cursor.plusDays(1);
    }
    return Math.round(totalLeaveDays * 100.0) / 100.0;
  }

  static double workHours(LocalDateTime punchIn, LocalDateTime punchOut) {
    if (punchIn == null || punchOut == null || !punchOut.isAfter(punchIn)) {
      return 0;
    }
    double hours = Duration.between(punchIn, punchOut).toMinutes() / 60.0;
    return Math.round(hours * 100.0) / 100.0;
  }

  private static DailyLeaveSummary dailyLeaveSummary(LocalDate day, List<TimeRange> leaveRanges) {
    List<TimeRange> workIntervals = buildWorkIntervals(day);
    List<TimeRange> requiredSegments = new ArrayList<>();
    for (TimeRange workInterval : workIntervals) {
      requiredSegments.addAll(subtractRange(workInterval, leaveRanges));
    }

    int totalWorkMinutes = minutes(workIntervals);
    int requiredWorkMinutes = minutes(requiredSegments);
    int leaveMinutes = Math.max(0, totalWorkMinutes - requiredWorkMinutes);
    String leaveScope = LEAVE_SCOPE_NONE;
    if (leaveMinutes > 0) {
      leaveScope = requiredWorkMinutes == 0 ? LEAVE_SCOPE_FULL : LEAVE_SCOPE_PARTIAL;
    }
    return new DailyLeaveSummary(leaveMinutes, leaveScope);
  }

  private static List<TimeRange> buildWorkIntervals(LocalDate day) {
    return List.of(
        new TimeRange(day.atTime(9, 0), day.atTime(12, 0)),
        new TimeRange(day.atTime(14, 0), day.atTime(18, 0)));
  }

  private static List<TimeRange> normalizeRanges(List<TimeRange> ranges) {
    if (ranges == null || ranges.isEmpty()) {
      return List.of();
    }
    List<TimeRange> validRanges =
        ranges.stream()
            .filter(range -> range != null && range.isValid())
            .sorted(Comparator.comparing(TimeRange::start))
            .toList();
    List<TimeRange> merged = new ArrayList<>();
    for (TimeRange range : validRanges) {
      if (merged.isEmpty()) {
        merged.add(range);
        continue;
      }
      TimeRange last = merged.get(merged.size() - 1);
      if (range.start().isAfter(last.end())) {
        merged.add(range);
      } else if (range.end().isAfter(last.end())) {
        merged.set(merged.size() - 1, new TimeRange(last.start(), range.end()));
      }
    }
    return merged;
  }

  private static List<TimeRange> subtractRange(TimeRange source, List<TimeRange> cuts) {
    List<TimeRange> segments = new ArrayList<>(List.of(source));
    for (TimeRange cut : cuts) {
      List<TimeRange> nextSegments = new ArrayList<>();
      for (TimeRange segment : segments) {
        if (!cut.end().isAfter(segment.start()) || !cut.start().isBefore(segment.end())) {
          nextSegments.add(segment);
          continue;
        }
        if (cut.start().isAfter(segment.start())) {
          nextSegments.add(new TimeRange(segment.start(), cut.start()));
        }
        if (cut.end().isBefore(segment.end())) {
          nextSegments.add(new TimeRange(cut.end(), segment.end()));
        }
      }
      segments = nextSegments;
    }
    return segments.stream().filter(TimeRange::isValid).toList();
  }

  private static int minutes(List<TimeRange> ranges) {
    return (int)
        Math.round(
            ranges.stream()
                .mapToLong(range -> Duration.between(range.start(), range.end()).toMillis())
                .sum()
                / 60_000.0);
  }

  record AttendanceSchedule(Integer employeeId, Integer userId, LocalTime checkIn, LocalTime checkOut) {
    static AttendanceSchedule defaults(Integer userId) {
      return new AttendanceSchedule(null, userId, DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT);
    }

    LocalTime checkInOrDefault() {
      return checkIn == null ? DEFAULT_CHECK_IN : checkIn;
    }

    LocalTime checkOutOrDefault() {
      return checkOut == null ? DEFAULT_CHECK_OUT : checkOut;
    }
  }

  record AttendanceState(int leaveMinutes, String leaveScope, int status) {}

  record TimeRange(LocalDateTime start, LocalDateTime end) {
    boolean isValid() {
      return start != null && end != null && end.isAfter(start);
    }

    TimeRange intersect(TimeRange other) {
      LocalDateTime intersectionStart = start.isAfter(other.start()) ? start : other.start();
      LocalDateTime intersectionEnd = end.isBefore(other.end()) ? end : other.end();
      return intersectionEnd.isAfter(intersectionStart)
          ? new TimeRange(intersectionStart, intersectionEnd)
          : null;
    }
  }

  private record DailyLeaveSummary(int leaveMinutes, String leaveScope) {}
}
