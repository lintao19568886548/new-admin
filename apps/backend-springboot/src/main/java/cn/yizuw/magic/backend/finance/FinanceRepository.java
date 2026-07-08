package cn.yizuw.magic.backend.finance;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * 财务模块只读数据访问层。
 *
 * <p>第十批只迁移 GET 查询，不迁移旧接口中的租赁费用同步副作用，保持本批为纯只读边界。
 */
@Repository
public class FinanceRepository {

  private static final Pattern ARABIC_NUMBER_PATTERN = Pattern.compile("\\d+");
  private static final Pattern CHINESE_NUMBER_PATTERN =
      Pattern.compile("[零一二三四五六七八九十百千万亿]+");
  private static final Pattern SEPARATED_MONTH_PATTERN =
      Pattern.compile("((?:19|20)\\d{2})[年/.-](0?[1-9]|1[0-2])月?份?");
  private static final Pattern COMPACT_MONTH_PATTERN = Pattern.compile("((?:19|20)\\d{2})(0[1-9]|1[0-2])");

  /** 财务分页列表，按当前用户授权园区过滤。 */
  public PageResult<Map<String, Object>> findFinancePage(
      JdbcTemplate jdbcTemplate, FinanceQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    if (!readableFinanceTable(columns)) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    appendNotDeleted(where, columns);
    if (!appendParkFilter(where, args, authorizedParkIds, query.parkId(), false)) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }
    appendBillNameFilter(where, args, columns, query.billName());
    appendEquals(where, args, columns, "bill_category", query.billCategory());
    appendEquals(where, args, columns, "transaction_type", query.transactionType());
    appendStatusFilter(where, args, columns, query.status());
    appendAmountFilter(where, args, columns, query.amount());
    appendDateRange(where, args, columns, "transaction_time", query.startTime(), query.endTime());

    List<Map<String, Object>> allRows =
        jdbcTemplate.query(
            """
            SELECT *
            FROM finance f
            """
                + where,
            (rs, rowNum) -> financeMap(rs, columns),
            args.toArray());
    allRows.sort(financeComparator());
    List<Map<String, Object>> pageItems = page(allRows, query.currentPage(), query.pageSize());
    appendImages(jdbcTemplate, pageItems);
    return new PageResult<>(pageItems, allRows.size(), query.currentPage(), query.pageSize());
  }

  /** 财务详情；旧接口允许 parkId 为空的记录被当前登录用户读取。 */
  public Map<String, Object> findFinanceDetail(
      JdbcTemplate jdbcTemplate, int financeId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    if (!readableFinanceTable(columns)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到财务记录");
    }

    StringBuilder sql = new StringBuilder("SELECT * FROM finance f WHERE f.finance_id = ?");
    if (columns.contains("is_deleted")) {
      sql.append(" AND f.is_deleted = false");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(sql.toString(), (rs, rowNum) -> financeMap(rs, columns), financeId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到财务记录");
    }
    Map<String, Object> finance = rows.get(0);
    Object rawParkId = finance.get("parkId");
    if (rawParkId instanceof Number number && !authorizedParkIds.contains(number.intValue())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无该园区财务权限");
    }
    appendImages(jdbcTemplate, rows);
    return finance;
  }

  /** 新增财务流水主表记录；只写 finance 白名单字段，避免旧 body 透传误写关系表。 */
  public Map<String, Object> createFinance(
      JdbcTemplate jdbcTemplate,
      FinanceCreateRequest request,
      List<Integer> authorizedParkIds) {
    if (request == null || !StringUtils.hasText(request.billName())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "账单名称 (billName) 是必填项");
    }
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    if (!readableFinanceTable(columns)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "财务表缺少必要字段");
    }

    Integer parkId = integerValue(request.parkId(), "parkId参数错误");
    if (parkId != null && parkId <= 0) {
      parkId = null;
    }
    if (parkId != null && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无该园区财务权限");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendInsertString(insertColumns, args, columns, "bill_name", request.billName());
    appendInsertString(insertColumns, args, columns, "bill_category", request.billCategory());
    appendInsertDecimal(insertColumns, args, columns, "amount", request.amount());
    appendInsertString(insertColumns, args, columns, "transaction_type", request.transactionType());
    if (columns.contains("transaction_time")) {
      insertColumns.add("transaction_time");
      args.add(
          request.transactionTime() == null
              ? Timestamp.from(Instant.now())
              : timestampValue(request.transactionTime(), "transactionTime参数错误"));
    }
    appendInsertString(insertColumns, args, columns, "remark", request.remark());
    if (columns.contains("park_id")) {
      insertColumns.add("park_id");
      args.add(parkId);
    }
    Timestamp now = Timestamp.from(Instant.now());
    appendInsertTimestamp(insertColumns, args, columns, "create_time", now);
    appendInsertTimestamp(insertColumns, args, columns, "update_time", now);
    if (columns.contains("is_deleted")) {
      insertColumns.add("is_deleted");
      args.add(false);
    }

    jdbcTemplate.update(
        "INSERT INTO finance ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer financeId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (financeId == null || financeId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "插入财务数据失败");
    }
    return findFinanceDetail(jdbcTemplate, financeId, authorizedParkIds);
  }

  /** 逻辑删除财务流水，保持旧接口只写 finance.is_deleted 的低副作用语义。 */
  public Map<String, Object> softDeleteFinance(
      JdbcTemplate jdbcTemplate, int financeId, List<Integer> authorizedParkIds) {
    findFinanceDetail(jdbcTemplate, financeId, authorizedParkIds);
    if (!columnSet(jdbcTemplate, "finance").contains("is_deleted")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "财务表缺少删除标记字段");
    }
    jdbcTemplate.update("UPDATE finance SET is_deleted = true WHERE finance_id = ?", financeId);
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT * FROM finance WHERE finance_id = ? LIMIT 1",
            (rs, rowNum) -> financeMap(rs, columns),
            financeId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到财务记录");
    }
    appendImages(jdbcTemplate, rows);
    return rows.get(0);
  }

  /** 批量软删当前授权园区内的财务流水；不删除 finance_image，也不触发任何外部同步。 */
  public Map<String, Object> softDeleteAuthorizedFinances(
      JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {
    if (authorizedParkIds.isEmpty()) {
      return Map.of("deletedCount", 0);
    }
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    if (!readableFinanceTable(columns) || !columns.containsAll(Set.of("park_id", "is_deleted"))) {
      return Map.of("deletedCount", 0);
    }
    int deletedCount =
        jdbcTemplate.update(
            "UPDATE finance SET is_deleted = true WHERE is_deleted = false AND park_id IN ("
                + placeholders(authorizedParkIds.size())
                + ")",
            authorizedParkIds.toArray());
    return Map.of("deletedCount", deletedCount);
  }

  /** 更新财务流水主表字段；旧接口的图片删除/重建副作用不在本批执行。 */
  public Map<String, Object> updateFinance(
      JdbcTemplate jdbcTemplate,
      int financeId,
      FinanceUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findFinanceDetail(jdbcTemplate, financeId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();

    if (request != null && request.parkId() != null && columns.contains("park_id")) {
      Integer parkId = integerValue(request.parkId(), "parkId参数错误");
      if (parkId != null && parkId > 0 && !authorizedParkIds.contains(parkId)) {
        throw new BusinessException(HttpStatus.FORBIDDEN, "无该园区财务权限");
      }
      assignments.add("park_id = ?");
      args.add(parkId);
    }
    appendStringAssignment(assignments, args, columns, "bill_name", request == null ? null : request.billName());
    appendStringAssignment(
        assignments, args, columns, "bill_category", request == null ? null : request.billCategory());
    appendDecimalAssignment(assignments, args, columns, "amount", request == null ? null : request.amount());
    appendStringAssignment(
        assignments, args, columns, "transaction_type", request == null ? null : request.transactionType());
    appendTimestampAssignment(
        assignments,
        args,
        columns,
        "transaction_time",
        request == null ? null : request.transactionTime(),
        "transactionTime参数错误");
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendIntegerAssignment(assignments, args, columns, "status", request == null ? null : request.status());

    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供要更新的字段");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(financeId);
    jdbcTemplate.update(
        "UPDATE finance SET " + String.join(", ", assignments) + " WHERE finance_id = ?",
        args.toArray());
    return findFinanceDetail(jdbcTemplate, financeId, authorizedParkIds);
  }

  /** 财务账单名称下拉，按账单月份倒序去重，最多返回 100 条。 */
  public List<Map<String, Object>> findBillNameOptions(
      JdbcTemplate jdbcTemplate,
      String keyword,
      Integer requestedParkId,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "finance");
    if (!readableFinanceTable(columns) || authorizedParkIds.isEmpty()) {
      return List.of();
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    appendNotDeleted(where, columns);
    if (!appendParkFilter(where, args, authorizedParkIds, requestedParkId, false)) {
      return List.of();
    }
    appendBillNameFilter(where, args, columns, normalizeBillName(keyword));

    List<Map<String, Object>> records =
        jdbcTemplate.query(
            """
            SELECT *
            FROM finance f
            """
                + where,
            (rs, rowNum) -> financeMap(rs, columns),
            args.toArray());
    records.sort(financeComparator());

    Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
    for (Map<String, Object> record : records) {
      String billName = normalizeBillName(record.get("billName"));
      if (!StringUtils.hasText(billName)) {
        continue;
      }
      byName.putIfAbsent(billName.toLowerCase(Locale.ROOT), Map.of("label", billName, "value", billName));
      if (byName.size() >= 100) {
        break;
      }
    }
    return List.copyOf(byName.values());
  }

  private void appendNotDeleted(StringBuilder where, Set<String> columns) {
    if (columns.contains("is_deleted")) {
      where.append(" AND f.is_deleted = false");
    }
  }

  private boolean appendParkFilter(
      StringBuilder where,
      List<Object> args,
      List<Integer> authorizedParkIds,
      Integer requestedParkId,
      boolean throwOnForbidden) {
    if (authorizedParkIds.isEmpty()) {
      return false;
    }
    if (requestedParkId != null && requestedParkId > 0) {
      if (!authorizedParkIds.contains(requestedParkId)) {
        if (throwOnForbidden) {
          throw new BusinessException(HttpStatus.FORBIDDEN, "无该园区财务权限");
        }
        return false;
      }
      where.append(" AND f.park_id = ?");
      args.add(requestedParkId);
      return true;
    }
    where.append(" AND f.park_id IN (").append(placeholders(authorizedParkIds.size())).append(")");
    args.addAll(authorizedParkIds);
    return true;
  }

  private void appendBillNameFilter(
      StringBuilder where, List<Object> args, Set<String> columns, String billName) {
    if (!columns.contains("bill_name") || !StringUtils.hasText(billName)) {
      return;
    }

    List<String> keywords = new ArrayList<>();
    keywords.add(billName.trim());
    Matcher arabicMatcher = ARABIC_NUMBER_PATTERN.matcher(billName);
    while (arabicMatcher.find()) {
      keywords.add(encodeChineseNumber(arabicMatcher.group()));
    }
    Matcher chineseMatcher = CHINESE_NUMBER_PATTERN.matcher(billName);
    while (chineseMatcher.find()) {
      Integer value = decodeChineseNumber(chineseMatcher.group());
      if (value != null) {
        keywords.add(String.valueOf(value));
      }
    }

    List<String> uniqueKeywords =
        keywords.stream().filter(StringUtils::hasText).distinct().toList();
    where.append(" AND (");
    for (int index = 0; index < uniqueKeywords.size(); index += 1) {
      if (index > 0) {
        where.append(" OR ");
      }
      where.append("f.bill_name LIKE ?");
      args.add("%" + uniqueKeywords.get(index) + "%");
    }
    where.append(")");
  }

  private void appendEquals(
      StringBuilder where, List<Object> args, Set<String> columns, String column, String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND f.").append(column).append(" = ?");
      args.add(value.trim());
    }
  }

  private void appendStatusFilter(
      StringBuilder where, List<Object> args, Set<String> columns, Integer status) {
    if (columns.contains("status") && status != null) {
      where.append(" AND f.status = ?");
      args.add(status);
    }
  }

  private void appendAmountFilter(
      StringBuilder where, List<Object> args, Set<String> columns, String amount) {
    if (!columns.contains("amount") || !StringUtils.hasText(amount)) {
      return;
    }
    String value = amount.trim();
    if (value.startsWith(">=")) {
      appendAmountComparison(where, args, ">=", value.substring(2));
    } else if (value.startsWith("<=")) {
      appendAmountComparison(where, args, "<=", value.substring(2));
    } else if (value.startsWith(">")) {
      appendAmountComparison(where, args, ">", value.substring(1));
    } else if (value.startsWith("<")) {
      appendAmountComparison(where, args, "<", value.substring(1));
    } else if (value.contains("-")) {
      String[] parts = value.split("-", 2);
      BigDecimal min = decimal(parts[0]);
      BigDecimal max = decimal(parts.length > 1 ? parts[1] : null);
      if (min != null && max != null) {
        where.append(" AND f.amount BETWEEN ? AND ?");
        args.add(min);
        args.add(max);
      }
    } else {
      BigDecimal exact = decimal(value);
      if (exact != null) {
        where.append(" AND f.amount = ?");
        args.add(exact);
      }
    }
  }

  private void appendAmountComparison(
      StringBuilder where, List<Object> args, String operator, String rawValue) {
    BigDecimal value = decimal(rawValue);
    if (value != null) {
      where.append(" AND f.amount ").append(operator).append(" ?");
      args.add(value);
    }
  }

  private void appendDateRange(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String column,
      String start,
      String end) {
    if (!columns.contains(column)) {
      return;
    }
    if (StringUtils.hasText(start)) {
      where.append(" AND f.").append(column).append(" >= ?");
      args.add(normalizeRangeBoundary(start, false));
    }
    if (StringUtils.hasText(end)) {
      where.append(" AND f.").append(column).append(" <= ?");
      args.add(normalizeRangeBoundary(end, true));
    }
  }

  private String normalizeRangeBoundary(String value, boolean endOfDay) {
    String trimmed = value.trim();
    if (trimmed.contains(" ") || trimmed.contains("T")) {
      return trimmed;
    }
    return trimmed + (endOfDay ? " 23:59:59" : " 00:00:00");
  }

  private void appendImages(JdbcTemplate jdbcTemplate, List<Map<String, Object>> finances) {
    if (finances.isEmpty()) {
      return;
    }
    if (!columnSet(jdbcTemplate, "finance_image").containsAll(Set.of("finance_id", "url"))) {
      finances.forEach(row -> row.put("images", List.of()));
      return;
    }
    List<Integer> ids =
        finances.stream()
            .map(row -> row.get("financeId"))
            .filter(Number.class::isInstance)
            .map(Number.class::cast)
            .map(Number::intValue)
            .toList();
    if (ids.isEmpty()) {
      finances.forEach(row -> row.put("images", List.of()));
      return;
    }
    Map<Integer, List<Map<String, Object>>> imagesByFinanceId = new LinkedHashMap<>();
    jdbcTemplate
        .query(
            "SELECT id, finance_id, url FROM finance_image WHERE finance_id IN ("
                + placeholders(ids.size())
                + ") ORDER BY id ASC",
            (rs, rowNum) -> financeImageMap(rs),
            ids.toArray())
        .forEach(
            image -> {
              Object rawFinanceId = image.get("financeId");
              if (rawFinanceId instanceof Number number) {
                imagesByFinanceId.computeIfAbsent(number.intValue(), ignored -> new ArrayList<>()).add(image);
              }
            });
    for (Map<String, Object> finance : finances) {
      Object rawFinanceId = finance.get("financeId");
      int financeId = rawFinanceId instanceof Number number ? number.intValue() : 0;
      finance.put("images", imagesByFinanceId.getOrDefault(financeId, List.of()));
    }
  }

  private Map<String, Object> financeMap(ResultSet rs, Set<String> columns) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("financeId", rs.getInt("finance_id"));
    map.put("billName", safeString(rs, "bill_name"));
    map.put("billCategory", safeString(rs, "bill_category"));
    map.put("amount", safeBigDecimal(rs, "amount"));
    map.put("transactionType", safeString(rs, "transaction_type"));
    map.put("transactionTime", toIso(safeTimestamp(rs, "transaction_time")));
    map.put("remark", safeString(rs, "remark"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("status", columns.contains("status") ? safeInteger(rs, "status") : 0);
    map.put("isDeleted", columns.contains("is_deleted") && Boolean.TRUE.equals(safeBoolean(rs, "is_deleted")));
    return map;
  }

  private Map<String, Object> financeImageMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getInt("id"));
    map.put("financeId", rs.getInt("finance_id"));
    map.put("url", rs.getString("url"));
    return map;
  }

  private Comparator<Map<String, Object>> financeComparator() {
    return (left, right) -> compareFinanceRows(left, right);
  }

  private int compareFinanceRows(Map<String, Object> left, Map<String, Object> right) {
    List<Integer> leftKeys = parseMonthSortKeys(left.get("billName"));
    List<Integer> rightKeys = parseMonthSortKeys(right.get("billName"));
    boolean leftHasMonth = !leftKeys.isEmpty();
    boolean rightHasMonth = !rightKeys.isEmpty();
    if (leftHasMonth != rightHasMonth) {
      return leftHasMonth ? -1 : 1;
    }
    if (leftHasMonth) {
      int maxLength = Math.max(leftKeys.size(), rightKeys.size());
      for (int index = 0; index < maxLength; index += 1) {
        int leftKey = index < leftKeys.size() ? leftKeys.get(index) : 0;
        int rightKey = index < rightKeys.size() ? rightKeys.get(index) : 0;
        if (leftKey != rightKey) {
          return Integer.compare(rightKey, leftKey);
        }
      }
    }
    int transactionDiff = Long.compare(time(right.get("transactionTime")), time(left.get("transactionTime")));
    if (transactionDiff != 0) {
      return transactionDiff;
    }
    int createDiff = Long.compare(time(right.get("createTime")), time(left.get("createTime")));
    if (createDiff != 0) {
      return createDiff;
    }
    return Integer.compare(number(right.get("financeId")), number(left.get("financeId")));
  }

  private List<Integer> parseMonthSortKeys(Object value) {
    String text = normalizeBillName(value).replaceAll("\\s+", "");
    if (!StringUtils.hasText(text)) {
      return List.of();
    }
    Set<Integer> keys = new LinkedHashSet<>();
    Matcher separated = SEPARATED_MONTH_PATTERN.matcher(text);
    while (separated.find()) {
      Integer key = toMonthSortKey(separated.group(1), separated.group(2));
      if (key != null) {
        keys.add(key);
      }
    }
    Matcher compact = COMPACT_MONTH_PATTERN.matcher(text);
    while (compact.find()) {
      Integer key = toMonthSortKey(compact.group(1), compact.group(2));
      if (key != null) {
        keys.add(key);
      }
    }
    return List.copyOf(keys);
  }

  private Integer toMonthSortKey(String year, String month) {
    try {
      int parsedYear = Integer.parseInt(year);
      int parsedMonth = Integer.parseInt(month);
      if (parsedYear < 1900 || parsedYear > 2100 || parsedMonth < 1 || parsedMonth > 12) {
        return null;
      }
      return parsedYear * 12 + parsedMonth;
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private List<Map<String, Object>> page(List<Map<String, Object>> rows, int currentPage, int pageSize) {
    int from = Math.min((currentPage - 1) * pageSize, rows.size());
    int to = Math.min(from + pageSize, rows.size());
    return new ArrayList<>(rows.subList(from, to));
  }

  private boolean readableFinanceTable(Set<String> columns) {
    return columns.contains("finance_id") && columns.contains("bill_name");
  }

  private Set<String> columnSet(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate
        .queryForList(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            String.class,
            tableName)
        .stream()
        .map(name -> name.toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private BigDecimal decimal(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      return new BigDecimal(value.trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private String normalizeBillName(Object value) {
    return String.valueOf(value == null ? "" : value).replaceAll("\\s+", " ").trim();
  }

  private String encodeChineseNumber(String value) {
    try {
      int number = Integer.parseInt(value);
      if (number == 0) {
        return "零";
      }
      if (number <= 10) {
        return List.of("", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十").get(number);
      }
      return value;
    } catch (NumberFormatException error) {
      return value;
    }
  }

  private Integer decodeChineseNumber(String value) {
    return switch (value) {
      case "零" -> 0;
      case "一" -> 1;
      case "二" -> 2;
      case "三" -> 3;
      case "四" -> 4;
      case "五" -> 5;
      case "六" -> 6;
      case "七" -> 7;
      case "八" -> 8;
      case "九" -> 9;
      case "十" -> 10;
      default -> null;
    };
  }

  private void appendStringAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      String value) {
    if (columns.contains(columnName) && value != null) {
      assignments.add(columnName + " = ?");
      args.add(blankToNull(value));
    }
  }

  private void appendInsertString(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      String value) {
    if (columns.contains(columnName) && value != null) {
      insertColumns.add(columnName);
      args.add(blankToNull(value));
    }
  }

  private void appendInsertDecimal(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      BigDecimal value) {
    if (columns.contains(columnName) && value != null) {
      insertColumns.add(columnName);
      args.add(value);
    }
  }

  private void appendInsertTimestamp(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Timestamp value) {
    if (columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(value);
    }
  }

  private void appendDecimalAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      BigDecimal value) {
    if (columns.contains(columnName) && value != null) {
      assignments.add(columnName + " = ?");
      args.add(value);
    }
  }

  private void appendIntegerAssignment(
      List<String> assignments, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (columns.contains(columnName) && value != null) {
      assignments.add(columnName + " = ?");
      args.add(integerValue(value, columnName + "参数错误"));
    }
  }

  private void appendTimestampAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      String value,
      String message) {
    if (columns.contains(columnName) && value != null) {
      assignments.add(columnName + " = ?");
      args.add(timestampValue(value, message));
    }
  }

  private String blankToNull(String value) {
    String text = value == null ? "" : value.trim();
    return StringUtils.hasText(text) ? text : null;
  }

  private Integer integerValue(Object value, String message) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    String text = String.valueOf(value == null ? "" : value).trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      return Integer.parseInt(text);
    } catch (NumberFormatException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Timestamp timestampValue(String value, String message) {
    String text = value == null ? "" : value.trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with offset or local date-time formats used by the old frontend.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss / yyyy-MM-ddTHH:mm:ss.
    }
    try {
      String normalized = text.replace('T', ' ');
      if (normalized.length() == 10) {
        normalized = normalized + " 00:00:00";
      }
      return Timestamp.valueOf(LocalDateTime.parse(normalized.replace(' ', 'T')));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Integer safeInteger(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName, Integer.class);
    } catch (SQLException error) {
      return null;
    }
  }

  private Boolean safeBoolean(ResultSet rs, String columnName) throws SQLException {
    try {
      Object value = rs.getObject(columnName);
      if (value instanceof Boolean bool) {
        return bool;
      }
      if (value instanceof Number number) {
        return number.intValue() != 0;
      }
      return value == null ? null : Boolean.valueOf(String.valueOf(value));
    } catch (SQLException error) {
      return null;
    }
  }

  private BigDecimal safeBigDecimal(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getBigDecimal(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String safeString(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getString(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private Timestamp safeTimestamp(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getTimestamp(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private int number(Object value) {
    return value instanceof Number number ? number.intValue() : 0;
  }

  private long time(Object value) {
    if (value == null) {
      return 0;
    }
    try {
      return Timestamp.valueOf(String.valueOf(value).replace("T", " ").replace("Z", "")).getTime();
    } catch (IllegalArgumentException error) {
      try {
        return java.time.Instant.parse(String.valueOf(value)).toEpochMilli();
      } catch (RuntimeException ignored) {
        return 0;
      }
    }
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
