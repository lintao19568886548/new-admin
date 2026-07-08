package cn.yizuw.magic.backend.dashboard.overview;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/** 看板日期解析工具，复刻旧接口只接受 yyyy-MM-dd 的宽松策略。 */
final class DashboardDateUtils {

  static final ZoneId DASHBOARD_ZONE = ZoneId.systemDefault();
  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

  private DashboardDateUtils() {}

  static LocalDate parseDate(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return LocalDate.parse(value.trim(), DATE_FORMATTER);
    } catch (DateTimeParseException error) {
      return null;
    }
  }

  static LocalDate referenceDate(String value) {
    return referenceDate(value, LocalDate.now(DASHBOARD_ZONE));
  }

  static LocalDate referenceDate(String value, LocalDate fallback) {
    LocalDate parsed = parseDate(value);
    return parsed == null ? fallback : parsed;
  }

  static DateRange dateRange(String startValue, String endValue) {
    LocalDate start = parseDate(startValue);
    LocalDate end = parseDate(endValue);
    if (start != null && end != null) {
      LocalDate periodStartDate = start.isBefore(end) ? start : end;
      LocalDate periodEndDate = start.isBefore(end) ? end : start;
      return new DateRange(periodStartDate, periodEndDate);
    }

    LocalDate referenceDate = referenceDate(endValue);
    return new DateRange(referenceDate, referenceDate);
  }

  static List<YearMonth> currentYearMonths(LocalDate referenceDate) {
    List<YearMonth> months = new ArrayList<>();
    YearMonth current = YearMonth.of(referenceDate.getYear(), 1);
    YearMonth end = YearMonth.from(referenceDate);
    while (!current.isAfter(end)) {
      months.add(current);
      current = current.plusMonths(1);
    }
    return List.copyOf(months);
  }

  static String formatMonth(YearMonth month) {
    return month.toString();
  }

  record DateRange(LocalDate periodStartDate, LocalDate periodEndDate) {}
}
