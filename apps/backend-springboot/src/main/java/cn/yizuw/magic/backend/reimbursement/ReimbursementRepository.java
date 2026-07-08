package cn.yizuw.magic.backend.reimbursement;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * 报销模块只读数据访问层。
 *
 * <p>真实库可能来自旧 SQL 快照或 Prisma schema，字段名存在 {@code username/userName}、{@code is_deleted}
 * 等差异；本层通过 information_schema 做运行时检测，避免灰度环境直接 500。
 */
@Repository
public class ReimbursementRepository {

  /** 查询报销分页列表。 */
  public PageResult<Map<String, Object>> findPage(
      JdbcTemplate jdbcTemplate, ReimbursementQuery query, ReimbursementScope scope) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns)) {
      return new PageResult<>(List.of(), 0, query.pageNo(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = baseWhere(columns);
    if (!appendScope(where, args, columns, scope, query.parkId(), false)) {
      return new PageResult<>(List.of(), 0, query.pageNo(), query.pageSize());
    }
    appendFilters(where, args, columns, query);

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM reimbursement r " + where, Long.class, args.toArray());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT r.*, p.park_name FROM reimbursement r "
                + parkJoin(columns)
                + where
                + " ORDER BY r.create_time DESC LIMIT ?, ?",
            (rs, rowNum) -> reimbursementMap(rs, columns),
            pageArgs(args, query.pageNo(), query.pageSize()).toArray());
    appendImages(jdbcTemplate, rows);
    return new PageResult<>(rows, total == null ? 0 : total, query.pageNo(), query.pageSize());
  }

  /** 查询报销详情；在旧接口基础上补齐本人/园区权限校验。 */
  public Map<String, Object> findDetail(
      JdbcTemplate jdbcTemplate, int id, ReimbursementScope scope) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到报销记录");
    }

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT r.*, p.park_name FROM reimbursement r "
                + parkJoin(columns)
                + baseWhere(columns)
                + " AND r.id = ? LIMIT 1",
            (rs, rowNum) -> reimbursementMap(rs, columns),
            id);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到报销记录");
    }
    Map<String, Object> row = rows.get(0);
    if (!canRead(row, scope)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    appendImages(jdbcTemplate, rows);
    return row;
  }

  /** 新增报销主表记录；图片关系和审核通过财务同步不在本批迁移范围内。 */
  public Map<String, Object> create(
      JdbcTemplate jdbcTemplate,
      ReimbursementCreateRequest request,
      ReimbursementScope scope) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns) || !columns.contains("payee")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销表结构不完整");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendRequiredTextInsert(insertColumns, args, columns, "purpose", request.purpose(), "报销事由不能为空");
    appendRequiredAmountInsert(insertColumns, args, columns, request.amount());
    appendRequiredTextInsert(insertColumns, args, columns, "payee", request.payee(), "收款人不能为空");
    appendTimestampInsert(insertColumns, args, columns, "date", timestampValueOrNow(request.date(), "date参数错误"));
    appendTextInsert(insertColumns, args, columns, "department", request.department());
    appendTextInsert(insertColumns, args, columns, "username", request.username());
    appendTextInsert(insertColumns, args, columns, "claimant", request.claimant());
    appendTextInsert(insertColumns, args, columns, "remark", request.remark());
    if (columns.contains("status")) {
      insertColumns.add("status");
      args.add(request.status() == null ? 0 : request.status());
    }
    if (columns.contains("is_deleted")) {
      insertColumns.add("is_deleted");
      args.add(false);
    }
    if (columns.contains("user_id") && scope.tenantUserId() != null) {
      insertColumns.add("user_id");
      args.add(scope.tenantUserId());
    }
    appendParkInsert(insertColumns, args, columns, request.parkId(), scope);
    Timestamp now = Timestamp.from(Instant.now());
    appendTimestampInsert(insertColumns, args, columns, "create_time", now);
    appendTimestampInsert(insertColumns, args, columns, "update_time", now);

    jdbcTemplate.update(
        "INSERT INTO reimbursement ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (id == null || id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "插入报销数据失败");
    }
    return findDetail(jdbcTemplate, id, scope);
  }

  /** 查询待审核/删除前快照；不套读取范围，权限由 Service 按旧接口规则判断。 */
  public Map<String, Object> findForWrite(JdbcTemplate jdbcTemplate, int id) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到报销记录");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT r.*, p.park_name FROM reimbursement r "
                + parkJoin(columns)
                + baseWhere(columns)
                + " AND r.id = ? LIMIT 1",
            (rs, rowNum) -> reimbursementMap(rs, columns),
            id);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到报销记录");
    }
    return rows.get(0);
  }

  /** 更新审核状态和意见；finance 同步由后续专项批次接入。 */
  public Map<String, Object> audit(
      JdbcTemplate jdbcTemplate,
      int id,
      int status,
      String auditOpinion,
      ReimbursementScope scope) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns) || !columns.contains("audit_opinion")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销表结构不完整");
    }
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    assignments.add("status = ?");
    args.add(status);
    assignments.add("audit_opinion = ?");
    args.add(auditOpinion);
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(id);
    jdbcTemplate.update(
        "UPDATE reimbursement SET " + String.join(", ", assignments) + " WHERE id = ?",
        args.toArray());
    return findDetail(jdbcTemplate, id, scope);
  }

  /** 软删除报销主表并返回删除后的快照；不联动 finance 或 reimbursement_image。 */
  public Map<String, Object> softDelete(JdbcTemplate jdbcTemplate, int id) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns) || !columns.contains("is_deleted")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销表结构不完整");
    }
    List<String> assignments = new ArrayList<>();
    assignments.add("is_deleted = true");
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    jdbcTemplate.update(
        "UPDATE reimbursement SET " + String.join(", ", assignments) + " WHERE id = ?",
        id);
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT r.*, p.park_name FROM reimbursement r "
                + parkJoin(columns)
                + "WHERE r.id = ? LIMIT 1",
            (rs, rowNum) -> reimbursementMap(rs, columns),
            id);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到报销记录");
    }
    appendImages(jdbcTemplate, rows);
    return rows.get(0);
  }

  /** 查询审核人员授权园区内的待处理报销数量。 */
  public long countPending(JdbcTemplate jdbcTemplate, ReimbursementScope scope) {
    if (!scope.hasAuditPermission()) {
      return 0;
    }
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns) || !columns.contains("park_id") || scope.authorizedParkIds().isEmpty()) {
      return 0;
    }
    List<Object> args = new ArrayList<>();
    StringBuilder where = baseWhere(columns);
    where.append(" AND r.status = 0 AND r.park_id IN (")
        .append(placeholders(scope.authorizedParkIds().size()))
        .append(")");
    args.addAll(scope.authorizedParkIds());
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM reimbursement r " + where, Long.class, args.toArray());
    return count == null ? 0 : count;
  }

  /** 按状态聚合报销数量。 */
  public Map<String, Object> summary(
      JdbcTemplate jdbcTemplate, ReimbursementQuery query, ReimbursementScope scope) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    Map<String, Object> empty = summaryMap(0, 0, 0, 0);
    if (!readableTable(columns)) {
      return empty;
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = baseWhere(columns);
    if (!appendScope(where, args, columns, scope, query.parkId(), false)) {
      return empty;
    }
    appendFilters(where, args, columns, query);
    List<Map<String, Object>> grouped =
        jdbcTemplate.query(
            "SELECT r.status, COUNT(*) AS total FROM reimbursement r "
                + where
                + " GROUP BY r.status",
            (rs, rowNum) -> Map.of("status", rs.getInt("status"), "total", rs.getLong("total")),
            args.toArray());

    long pending = 0;
    long approved = 0;
    long rejected = 0;
    long total = 0;
    for (Map<String, Object> item : grouped) {
      long count = ((Number) item.get("total")).longValue();
      total += count;
      int status = ((Number) item.get("status")).intValue();
      if (status == 0) {
        pending = count;
      } else if (status == 1) {
        approved = count;
      } else if (status == 2) {
        rejected = count;
      }
    }
    return summaryMap(pending, approved, rejected, total);
  }

  /** 报销分析数据，仅审核人员可读。 */
  public Map<String, Object> analysis(
      JdbcTemplate jdbcTemplate,
      String startDate,
      String endDate,
      Integer parkId,
      Integer status,
      ReimbursementScope scope) {
    Set<String> columns = columnSet(jdbcTemplate, "reimbursement");
    if (!readableTable(columns) || !columns.containsAll(Set.of("park_id", "date", "amount"))) {
      return emptyAnalysis();
    }
    int targetStatus = status == null ? 1 : status;
    DateRange range = analysisDateRange(startDate, endDate);
    List<Object> args = new ArrayList<>();
    StringBuilder where = baseWhere(columns);
    if (!appendScope(where, args, columns, scope, parkId, false)) {
      return emptyAnalysis();
    }
    where.append(" AND r.status = ? AND r.date BETWEEN ? AND ?");
    args.add(targetStatus);
    args.add(range.start());
    args.add(range.end());

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT r.amount, r.date, r.park_id, p.park_name
            FROM reimbursement r
            LEFT JOIN park p ON p.park_id = r.park_id
            """
                + where,
            (rs, rowNum) -> analysisRow(rs),
            args.toArray());
    return buildAnalysis(rows);
  }

  private StringBuilder baseWhere(Set<String> columns) {
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    if (columns.contains("is_deleted")) {
      where.append(" AND r.is_deleted = false");
    }
    return where;
  }

  private String parkJoin(Set<String> columns) {
    return columns.contains("park_id") ? "LEFT JOIN park p ON p.park_id = r.park_id " : "";
  }

  private boolean appendScope(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      ReimbursementScope scope,
      Integer requestedParkId,
      boolean throwOnForbidden) {
    if (scope.hasAuditPermission()) {
      if (!columns.contains("park_id") || scope.authorizedParkIds().isEmpty()) {
        return false;
      }
      if (requestedParkId != null && requestedParkId > 0) {
        if (!scope.authorizedParkIds().contains(requestedParkId)) {
          if (throwOnForbidden) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
          }
          return false;
        }
        where.append(" AND r.park_id = ?");
        args.add(requestedParkId);
        return true;
      }
      where.append(" AND r.park_id IN (").append(placeholders(scope.authorizedParkIds().size())).append(")");
      args.addAll(scope.authorizedParkIds());
      return true;
    }
    if (columns.contains("user_id") && scope.tenantUserId() != null) {
      where.append(" AND r.user_id = ?");
      args.add(scope.tenantUserId());
    }
    return true;
  }

  private void appendFilters(
      StringBuilder where, List<Object> args, Set<String> columns, ReimbursementQuery query) {
    appendEquals(where, args, columns, "claimant", query.claimant());
    appendLike(where, args, columns, "purpose", query.purpose());
    appendEquals(where, args, columns, "department", query.department());
    appendLike(where, args, columns, "payee", query.payee());
    if (columns.contains("date")) {
      if (StringUtils.hasText(query.startDate())) {
        where.append(" AND r.date >= ?");
        args.add(normalizeBoundary(query.startDate(), false));
      }
      if (StringUtils.hasText(query.endDate())) {
        where.append(" AND r.date <= ?");
        args.add(normalizeBoundary(query.endDate(), true));
      }
    }
    if (query.status() != null) {
      where.append(" AND r.status = ?");
      args.add(query.status());
    }
  }

  private void appendEquals(
      StringBuilder where, List<Object> args, Set<String> columns, String column, String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND r.").append(column).append(" = ?");
      args.add(value.trim());
    }
  }

  private void appendLike(
      StringBuilder where, List<Object> args, Set<String> columns, String column, String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND r.").append(column).append(" LIKE ?");
      args.add("%" + value.trim() + "%");
    }
  }

  private Map<String, Object> reimbursementMap(ResultSet rs, Set<String> columns) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getInt("id"));
    map.put("purpose", safeString(rs, "purpose"));
    map.put("amount", safeBigDecimal(rs, "amount"));
    map.put("payee", safeString(rs, "payee"));
    map.put("date", toIso(safeTimestamp(rs, "date")));
    map.put("department", safeString(rs, "department"));
    map.put("username", username(rs, columns));
    map.put("remark", safeString(rs, "remark"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    map.put("status", safeInteger(rs, "status"));
    map.put("isDeleted", columns.contains("is_deleted") && Boolean.TRUE.equals(safeBoolean(rs, "is_deleted")));
    map.put("userId", safeInteger(rs, "user_id"));
    map.put("parkId", safeInteger(rs, "park_id"));
    String parkName = safeString(rs, "park_name");
    map.put("parkName", parkName);
    map.put("park", defaultString(parkName));
    map.put("auditOpinion", safeString(rs, "audit_opinion"));
    map.put("claimant", safeString(rs, "claimant"));
    return map;
  }

  private String username(ResultSet rs, Set<String> columns) throws SQLException {
    if (columns.contains("username")) {
      return safeString(rs, "username");
    }
    if (columns.contains("userName")) {
      return safeString(rs, "userName");
    }
    return null;
  }

  private void appendImages(JdbcTemplate jdbcTemplate, List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Set<String> relationColumns = columnSet(jdbcTemplate, "reimbursement_image");
    Set<String> imageColumns = columnSet(jdbcTemplate, "image");
    if (!relationColumns.containsAll(Set.of("reimbursement_id", "img_id"))
        || !imageColumns.containsAll(Set.of("img_id", "img_url"))) {
      rows.forEach(row -> row.put("images", List.of()));
      return;
    }
    List<Integer> ids =
        rows.stream()
            .map(row -> row.get("id"))
            .filter(Number.class::isInstance)
            .map(Number.class::cast)
            .map(Number::intValue)
            .toList();
    Map<Integer, List<String>> imagesById = new LinkedHashMap<>();
    jdbcTemplate
        .query(
            """
            SELECT ri.reimbursement_id, i.img_url
            FROM reimbursement_image ri
            LEFT JOIN image i ON i.img_id = ri.img_id
            WHERE ri.reimbursement_id IN (
            """
                + placeholders(ids.size())
                + """
                )
              AND i.img_url IS NOT NULL
              AND i.img_url <> ''
            ORDER BY ri.id ASC
            """,
            (rs, rowNum) -> Map.of("id", rs.getInt("reimbursement_id"), "url", rs.getString("img_url")),
            ids.toArray())
        .forEach(
            image -> {
              int id = ((Number) image.get("id")).intValue();
              imagesById.computeIfAbsent(id, ignored -> new ArrayList<>()).add(String.valueOf(image.get("url")));
            });
    for (Map<String, Object> row : rows) {
      Object rawId = row.get("id");
      int id = rawId instanceof Number number ? number.intValue() : 0;
      row.put("images", imagesById.getOrDefault(id, List.of()));
    }
  }

  private boolean canRead(Map<String, Object> row, ReimbursementScope scope) {
    if (scope.hasAuditPermission()) {
      Object rawParkId = row.get("parkId");
      return !(rawParkId instanceof Number number) || scope.authorizedParkIds().contains(number.intValue());
    }
    Object rawUserId = row.get("userId");
    return rawUserId == null
        || scope.tenantUserId() == null
        || rawUserId instanceof Number number && number.longValue() == scope.tenantUserId();
  }

  private Map<String, Object> analysisRow(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("amount", safeBigDecimal(rs, "amount"));
    map.put("date", toLocalDate(safeTimestamp(rs, "date")));
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("park", defaultString(safeString(rs, "park_name"), "未设置园区"));
    return map;
  }

  private Map<String, Object> buildAnalysis(List<Map<String, Object>> rows) {
    Map<Integer, ParkStat> parkStats = new LinkedHashMap<>();
    Map<String, TrendStat> trendStats = new LinkedHashMap<>();
    BigDecimal totalAmount = BigDecimal.ZERO;
    for (Map<String, Object> row : rows) {
      BigDecimal amount = decimal(row.get("amount"));
      int parkId = row.get("parkId") instanceof Number number ? number.intValue() : -1;
      String park = String.valueOf(row.get("park"));
      String date = String.valueOf(row.get("date"));
      totalAmount = totalAmount.add(amount);
      parkStats.compute(parkId, (ignored, stat) -> stat == null ? new ParkStat(1, parkId, park, amount) : stat.add(amount));
      trendStats.compute(date, (ignored, stat) -> stat == null ? new TrendStat(1, date, amount) : stat.add(amount));
    }
    List<Map<String, Object>> parkRows =
        parkStats.values().stream().sorted((left, right) -> right.totalAmount().compareTo(left.totalAmount())).map(ParkStat::toMap).toList();
    List<Map<String, Object>> trendRows =
        trendStats.values().stream().sorted(java.util.Comparator.comparing(TrendStat::date)).map(TrendStat::toMap).toList();
    int count = rows.size();
    BigDecimal average =
        count > 0 ? totalAmount.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
    Map<String, Object> summary =
        Map.of(
            "averageAmount", average,
            "count", count,
            "parkCount", parkRows.size(),
            "totalAmount", totalAmount);
    BigDecimal finalTotalAmount = totalAmount;
    List<Map<String, Object>> topParks =
        parkRows.stream()
            .limit(10)
            .map(row -> withRatio(row, finalTotalAmount))
            .toList();
    return Map.of("parkStats", parkRows, "summary", summary, "topParks", topParks, "trend", trendRows);
  }

  private Map<String, Object> withRatio(Map<String, Object> row, BigDecimal totalAmount) {
    Map<String, Object> copy = new LinkedHashMap<>(row);
    BigDecimal amount = decimal(copy.get("totalAmount"));
    copy.put(
        "ratio",
        totalAmount.compareTo(BigDecimal.ZERO) > 0
            ? amount.divide(totalAmount, 6, RoundingMode.HALF_UP)
            : BigDecimal.ZERO);
    return copy;
  }

  private Map<String, Object> emptyAnalysis() {
    return Map.of(
        "parkStats",
        List.of(),
        "summary",
        Map.of("averageAmount", 0, "count", 0, "parkCount", 0, "totalAmount", 0),
        "topParks",
        List.of(),
        "trend",
        List.of());
  }

  private Map<String, Object> summaryMap(long pending, long approved, long rejected, long total) {
    return Map.of("approved", approved, "pending", pending, "rejected", rejected, "total", total);
  }

  private boolean readableTable(Set<String> columns) {
    return columns.containsAll(Set.of("id", "purpose", "amount", "status"));
  }

  private void appendRequiredTextInsert(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      String value,
      String message) {
    if (!columns.contains(columnName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销表结构不完整");
    }
    String normalized = cleanText(value);
    if (!StringUtils.hasText(normalized)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    insertColumns.add(columnName);
    args.add(normalized);
  }

  private void appendRequiredAmountInsert(
      List<String> insertColumns, List<Object> args, Set<String> columns, BigDecimal amount) {
    final BigDecimal maxAmount = new BigDecimal("9999999999999.99");
    if (!columns.contains("amount")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销表结构不完整");
    }
    if (amount == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销金额不能为空");
    }
    if (amount.signum() <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销金额必须大于0");
    }
    if (amount.compareTo(maxAmount) > 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报销金额不能超过9,999,999,999,999.99");
    }
    insertColumns.add("amount");
    args.add(amount);
  }

  private void appendTextInsert(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      String value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(cleanText(value));
    }
  }

  private void appendTimestampInsert(
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

  private void appendParkInsert(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      Object rawParkId,
      ReimbursementScope scope) {
    if (rawParkId == null || !columns.contains("park_id")) {
      return;
    }
    int parkId = positiveInteger(rawParkId, "parkId参数错误");
    if (!scope.authorizedParkIds().contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    insertColumns.add("park_id");
    args.add(parkId);
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
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private List<Object> pageArgs(List<Object> args, int pageNo, int pageSize) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((pageNo - 1) * pageSize);
    pageArgs.add(pageSize);
    return pageArgs;
  }

  private String normalizeBoundary(String value, boolean endOfDay) {
    String trimmed = value.trim();
    if (trimmed.contains(" ") || trimmed.contains("T")) {
      return trimmed;
    }
    return trimmed + (endOfDay ? " 23:59:59" : " 00:00:00");
  }

  private String cleanText(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private int positiveInteger(Object value, String message) {
    if (value instanceof Number number) {
      int parsed = number.intValue();
      if (parsed > 0) {
        return parsed;
      }
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    try {
      int parsed = Integer.parseInt(String.valueOf(value).trim());
      if (parsed > 0) {
        return parsed;
      }
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Timestamp timestampValueOrNow(String value, String message) {
    if (!StringUtils.hasText(value)) {
      return Timestamp.from(Instant.now());
    }
    String text = value.trim();
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with offset/local legacy date-time formats.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss or yyyy-MM-ddTHH:mm:ss.
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

  private DateRange analysisDateRange(String startDate, String endDate) {
    LocalDate now = LocalDate.now();
    LocalDate start = StringUtils.hasText(startDate) ? analysisDate(startDate, "startDate参数错误") : now.withDayOfMonth(1);
    LocalDate end = StringUtils.hasText(endDate) ? analysisDate(endDate, "endDate参数错误") : now.withDayOfMonth(now.lengthOfMonth());
    if (start.isAfter(end)) {
      LocalDate swap = start;
      start = end;
      end = swap;
    }
    return new DateRange(start + " 00:00:00", end + " 23:59:59");
  }

  private LocalDate analysisDate(String value, String message) {
    try {
      String normalized = value.trim();
      if (normalized.length() > 10) {
        normalized = normalized.substring(0, 10);
      }
      return LocalDate.parse(normalized);
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
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

  private BigDecimal decimal(Object value) {
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    return BigDecimal.ZERO;
  }

  private String defaultString(Object value) {
    return defaultString(value, "");
  }

  private String defaultString(Object value, String fallback) {
    return value == null ? fallback : String.valueOf(value);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private String toLocalDate(Timestamp timestamp) {
    return timestamp == null ? "" : timestamp.toLocalDateTime().toLocalDate().toString();
  }

  private record DateRange(String start, String end) {}

  private record ParkStat(int count, int parkId, String park, BigDecimal totalAmount) {
    ParkStat add(BigDecimal amount) {
      return new ParkStat(count + 1, parkId, park, totalAmount.add(amount));
    }

    Map<String, Object> toMap() {
      return Map.of("count", count, "parkId", parkId, "park", park, "totalAmount", totalAmount);
    }
  }

  private record TrendStat(int count, String date, BigDecimal totalAmount) {
    TrendStat add(BigDecimal amount) {
      return new TrendStat(count + 1, date, totalAmount.add(amount));
    }

    Map<String, Object> toMap() {
      return Map.of("count", count, "date", date, "totalAmount", totalAmount);
    }
  }
}
