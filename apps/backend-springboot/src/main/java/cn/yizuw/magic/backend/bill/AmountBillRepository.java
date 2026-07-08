package cn.yizuw.magic.backend.bill;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/**
 * 总账单只读数据访问层。
 *
 * <p>迁移期只读取租户库 {@code amount_bill}，用于前端项目名称自动完成；不会写入账单或触发催缴短信。
 */
@Repository
public class AmountBillRepository {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final Map<String, String> COLLECTION_STATUS_LABELS =
      Map.of(
          "overpaid", "多收",
          "paid", "已收款",
          "partial", "部分收款",
          "unpaid", "未收款");
  private static final Map<String, String> COLLECTION_SMS_TYPE_LABELS =
      Map.of(
          "final_30", "长期未结提醒",
          "overdue_10", "逾期提醒",
          "payment_reminder", "缴费提醒");
  private static final Set<String> COLLECTION_SMS_ENTERPRISE_COMPANY_NAMES =
      Set.of(
          "东莞市亿胜物业管理有限公司",
          "东莞市十一兄弟实业投资有限公司",
          "东莞市启程物业管理有限公司",
          "佛山市十一智创物业管理有限公司",
          "佛山市十一智慧家具有限公司",
          "广州市十一兄弟产业投资有限公司",
          "深圳市十一兄弟产业服务有限公司");
  private static final Set<String> COLLECTION_SMS_PERSONAL_ACCOUNT_NAMES = Set.of("喻必胜", "肖德利");
  private static final Map<String, String> COLLECTION_SMS_PARK_COMPANY_NAME_MAP =
      Map.ofEntries(
          Map.entry("东莞光泰园区", "东莞市亿胜物业管理有限公司"),
          Map.entry("东莞同兴园区", "东莞市十一兄弟实业投资有限公司"),
          Map.entry("东莞同富园区", "东莞市启程物业管理有限公司"),
          Map.entry("佛山乐从园区", "佛山市十一智创物业管理有限公司"),
          Map.entry("佛山九江园区", "佛山市十一智慧家具有限公司"),
          Map.entry("广州园区（西州一）", "广州市十一兄弟产业投资有限公司"),
          Map.entry("广州荔新", "广州市十一兄弟产业投资有限公司"),
          Map.entry("广州西州二园区", "广州市十一兄弟产业投资有限公司"),
          Map.entry("深圳坪山23园区", "深圳市十一兄弟产业服务有限公司"));
  private static final Pattern SEPARATED_MONTH_PATTERN =
      Pattern.compile("((?:19|20)\\d{2})[年/.-](0?[1-9]|1[0-2])月?份?");
  private static final Pattern COMPACT_MONTH_PATTERN = Pattern.compile("((?:19|20)\\d{2})(0[1-9]|1[0-2])");

  /**
   * 查询总账单列表。
   *
   * <p>旧 Nitro 会先查全量再按账期月份和收款状态过滤；这里先下推园区、项目名、租户名、收款时间条件，再保持旧
   * JavaScript 侧账期月份过滤、排序、summary 和分页口径。
   */
  public Map<String, Object> findAmountBillPage(
      JdbcTemplate jdbcTemplate, AmountBillListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "amount_bill");
    if (!columns.containsAll(Set.of("bill_id", "project_name")) || authorizedParkIds.isEmpty()) {
      return amountBillPage(List.of(), 0, emptySummary());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            "SELECT ab.*, "
                + tenantNameExpression(jdbcTemplate, columns)
                + " AS joinedTenantName, "
                + parkNameExpression(jdbcTemplate, columns)
                + " AS parkName FROM amount_bill ab ");
    if (canJoinRentalTenant(jdbcTemplate, columns)) {
      sql.append(" LEFT JOIN rental_tenant rt ON rt.rental_tenant_id = ab.tenant_id ");
    }
    if (canJoinPark(jdbcTemplate, columns)) {
      sql.append(" LEFT JOIN park p ON p.park_id = ab.park_id ");
    }
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    if (!appendParkFilter(where, args, query.currentPark(), authorizedParkIds)) {
      return amountBillPage(List.of(), 0, emptySummary());
    }
    appendLike(where, args, columns, "project_name", query.projectName(), "ab");
    if (StringUtils.hasText(query.tenantName())) {
      List<String> tenantConditions = new ArrayList<>();
      if (columns.contains("tenant_name")) {
        tenantConditions.add("ab.tenant_name LIKE ?");
        args.add("%" + query.tenantName().trim() + "%");
      }
      if (canJoinRentalTenant(jdbcTemplate, columns) && hasColumn(jdbcTemplate, "rental_tenant", "tenant_name")) {
        tenantConditions.add("rt.tenant_name LIKE ?");
        args.add("%" + query.tenantName().trim() + "%");
      }
      if (!tenantConditions.isEmpty()) {
        where.append(" AND (").append(String.join(" OR ", tenantConditions)).append(")");
      }
    }
    appendReceiptTimeRange(where, args, columns, query.startTime(), query.endTime());

    List<Map<String, Object>> records =
        jdbcTemplate.query(
            sql.append(" ").append(where).toString(),
            (rs, rowNum) -> amountBillMap(rs, columns),
            args.toArray());
    MonthRange projectMonthRange = projectMonthRange(query.projectStartDate(), query.projectEndDate());
    List<Map<String, Object>> filtered =
        records.stream()
            .filter(item -> projectMonthInRange(item.get("projectName"), projectMonthRange))
            .map(this::enrichPaymentInfo)
            .filter(item -> matchesCollectionStatus(item, query.collectionStatus()))
            .sorted(this::compareProjectRows)
            .toList();
    Map<String, Object> summary = amountBillSummary(filtered);
    int page = normalizePage(query.currentPage());
    int size = normalizePageSize(query.pageSize());
    int fromIndex = Math.min((page - 1) * size, filtered.size());
    int toIndex = Math.min(fromIndex + size, filtered.size());
    return amountBillPage(filtered.subList(fromIndex, toIndex), filtered.size(), summary);
  }

  /** 查询总账单详情，保持旧接口详情不存在返回 null 的兼容行为。 */
  public Map<String, Object> findAmountBillDetail(
      JdbcTemplate jdbcTemplate, int billId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "amount_bill");
    if (!columns.contains("bill_id") || authorizedParkIds.isEmpty()) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT ab.*, "
                + tenantNameExpression(jdbcTemplate, columns)
                + " AS joinedTenantName, "
                + parkManagerExpression(jdbcTemplate, columns)
                + " AS parkManager FROM amount_bill ab "
                + (canJoinRentalTenant(jdbcTemplate, columns)
                    ? " LEFT JOIN rental_tenant rt ON rt.rental_tenant_id = ab.tenant_id "
                    : "")
                + (canJoinPark(jdbcTemplate, columns) ? " LEFT JOIN park p ON p.park_id = ab.park_id " : "")
                + " WHERE ab.bill_id = ? LIMIT 1",
            (rs, rowNum) -> amountBillMap(rs, columns),
            billId);
    if (rows.isEmpty()) {
      return null;
    }
    Map<String, Object> bill = enrichPaymentInfo(rows.get(0));
    Integer parkId = number(bill.get("parkId"));
    if (parkId != null && parkId > 0 && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    bill.put("eleBills", findMeterBills(jdbcTemplate, "ele_bill", "ele_id", billId));
    bill.put("waterBills", findMeterBills(jdbcTemplate, "water_bill", "water_id", billId));
    bill.put("tenant", Map.of("tenantName", defaultString(bill.get("tenantName"))));
    bill.put("park", Map.of("manager", defaultString(bill.get("parkManager"))));
    return bill;
  }

  /** 查询项目名称选项，按旧接口规则去重、最多返回 100 条。 */
  public List<Map<String, Object>> findProjectOptions(
      JdbcTemplate jdbcTemplate,
      String keyword,
      Integer requestedParkId,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "amount_bill");
    if (!columns.containsAll(Set.of("bill_id", "project_name")) || authorizedParkIds.isEmpty()) {
      return List.of();
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    if (!appendParkFilter(where, args, requestedParkId, authorizedParkIds)) {
      return List.of();
    }
    String normalizedKeyword = normalizeProjectName(keyword);
    if (StringUtils.hasText(normalizedKeyword)) {
      where.append(" AND ab.project_name LIKE ?");
      args.add("%" + normalizedKeyword + "%");
    }

    List<Map<String, Object>> records =
        jdbcTemplate.query(
            """
            SELECT ab.bill_id, ab.project_name, ab.receipt_time, ab.create_time
            FROM amount_bill ab
            """
                + where,
            (rs, rowNum) -> projectRecordMap(rs),
            args.toArray());
    records.sort(projectComparator());

    Map<String, Map<String, Object>> projectMap = new LinkedHashMap<>();
    for (Map<String, Object> record : records) {
      String projectName = normalizeProjectName(record.get("projectName"));
      if (!StringUtils.hasText(projectName)) {
        continue;
      }
      projectMap.putIfAbsent(
          projectName.toLowerCase(Locale.ROOT), Map.of("label", projectName, "value", projectName));
      if (projectMap.size() >= 100) {
        break;
      }
    }
    return List.copyOf(projectMap.values());
  }

  /**
   * 导出总账单 JSON 数据。
   *
   * <p>旧 Nitro 接口返回按园区分组的数组；这里继续返回数据结构，不生成文件，也不触发任何财务或短信副作用。
   */
  public List<Map<String, Object>> exportAmountBills(
      JdbcTemplate jdbcTemplate,
      AmountBillExportRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> parkColumns = columnSet(jdbcTemplate, "park");
    Set<String> billColumns = columnSet(jdbcTemplate, "amount_bill");
    if (!parkColumns.containsAll(Set.of("park_id", "park_name"))
        || !billColumns.containsAll(Set.of("bill_id", "park_id"))
        || authorizedParkIds.isEmpty()) {
      return List.of();
    }

    List<Integer> requestedParkIds = normalizePositiveIds(request == null ? null : request.parkIds());
    List<Integer> targetParkIds =
        requestedParkIds.isEmpty() ? authorizedParkIds : requestedParkIds;
    for (Integer parkId : targetParkIds) {
      if (!authorizedParkIds.contains(parkId)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
      }
    }

    List<Object> parkArgs = new ArrayList<>(targetParkIds);
    StringBuilder parkSql =
        new StringBuilder(
            "SELECT park_id, park_name FROM park WHERE park_id IN ("
                + placeholders(targetParkIds.size())
                + ")");
    if (parkColumns.contains("is_deleted")) {
      parkSql.append(" AND is_deleted = false");
    }
    parkSql.append(" ORDER BY park_id ASC");

    Map<Integer, Map<String, Object>> parkMap = new LinkedHashMap<>();
    jdbcTemplate
        .query(
            parkSql.toString(),
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("parkName", rs.getString("park_name"));
              row.put("bills", new ArrayList<Map<String, Object>>());
              row.put("_parkId", rs.getInt("park_id"));
              return row;
            },
            parkArgs.toArray())
        .forEach(row -> parkMap.put(number(row.get("_parkId")), row));
    if (parkMap.isEmpty()) {
      return List.of();
    }

    StringBuilder billSql =
        new StringBuilder(
            "SELECT ab.*, "
                + tenantNameExpression(jdbcTemplate, billColumns)
                + " AS joinedTenantName, "
                + parkNameExpression(jdbcTemplate, billColumns)
                + " AS parkName FROM amount_bill ab ");
    if (canJoinRentalTenant(jdbcTemplate, billColumns)) {
      billSql.append(" LEFT JOIN rental_tenant rt ON rt.rental_tenant_id = ab.tenant_id ");
    }
    if (canJoinPark(jdbcTemplate, billColumns)) {
      billSql.append(" LEFT JOIN park p ON p.park_id = ab.park_id ");
    }
    billSql
        .append(" WHERE ab.park_id IN (")
        .append(placeholders(parkMap.size()))
        .append(") ORDER BY ab.bill_id ASC");

    jdbcTemplate
        .query(
            billSql.toString(),
            (rs, rowNum) -> amountBillMap(rs, billColumns),
            parkMap.keySet().toArray())
        .forEach(
            bill -> {
              Map<String, Object> park = parkMap.get(number(bill.get("parkId")));
              if (park != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> bills =
                    (List<Map<String, Object>>) park.get("bills");
                bills.add(exportBillMap(bill));
              }
            });

    return parkMap.values().stream()
        .map(
            row -> {
              Map<String, Object> result = new LinkedHashMap<>(row);
              result.remove("_parkId");
              return result;
            })
        .toList();
  }

  /**
   * 催缴短信预览。
   *
   * <p>只读计算候选项、模板参数和汇总；不会发送短信，也不会写 {@code amount_bill_collection_sms_log}。
   */
  public Map<String, Object> previewCollectionSms(
      JdbcTemplate jdbcTemplate,
      AmountBillCollectionSmsPreviewRequest request,
      List<Integer> authorizedParkIds) {
    CollectionSmsOptions options = normalizeCollectionSmsOptions(request);
    List<Map<String, Object>> rows = listCollectionSmsBills(jdbcTemplate, options, authorizedParkIds);
    MonthRange projectMonthRange =
        projectMonthRange(
            stringFilter(options.filters(), "projectStartDate"),
            stringFilter(options.filters(), "projectEndDate"));
    List<Map<String, Object>> filteredBills =
        rows.stream()
            .filter(item -> projectMonthInRange(item.get("projectName"), projectMonthRange))
            .map(this::enrichPaymentInfo)
            .filter(
                item ->
                    matchesCollectionStatus(
                        item, normalizeCollectionStatus(options.filters().get("collectionStatus"))))
            .toList();
    Map<Integer, SmsLogSummary> logSummaries =
        findCollectionSmsLogSummaries(
            jdbcTemplate,
            filteredBills.stream().map(item -> number(item.get("billId"))).filter(id -> id > 0).toList(),
            options.collectionType());
    Map<String, Map<String, String>> templateIdMap = collectionSmsTemplateIdMap();

    List<Map<String, Object>> items =
        filteredBills.stream()
            .map(
                bill ->
                    collectionSmsCandidate(
                        bill, options, logSummaries, templateIdMap))
            .filter(item -> amount(item.get("remainingAmount")) > 0)
            .sorted(this::compareCollectionSmsCandidates)
            .toList();

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("options", collectionSmsOptionsMap(options));
    result.put("summary", collectionSmsSummary(items));
    return result;
  }

  /** 新增总账单主表和水电明细；本批不直接创建或更新 finance。 */
  public Map<String, Object> createAmountBill(
      DataSource dataSource, AmountBillSaveRequest request, List<Integer> authorizedParkIds) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
    Set<String> billColumns = columnSet(jdbcTemplate, "amount_bill");
    if (!billColumns.containsAll(Set.of("bill_id", "project_name"))) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "总账单表未初始化，请先执行 db push");
    }
    BillSaveData saveData = validateAndNormalizeBillSaveData(jdbcTemplate, request, authorizedParkIds, null);
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    Integer billId =
        transactionTemplate.execute(
            ignored -> {
              List<String> columns = new ArrayList<>();
              List<Object> args = new ArrayList<>();
              appendBillInsertColumns(columns, args, billColumns, saveData);
              jdbcTemplate.update(
                  "INSERT INTO amount_bill ("
                      + String.join(", ", columns)
                      + ") VALUES ("
                      + placeholders(columns.size())
                      + ")",
                  args.toArray());
              Integer createdId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
              if (createdId == null || createdId <= 0) {
                throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "插入数据失败");
              }
              replaceMeterBills(jdbcTemplate, "ele_bill", "ele_id", createdId, request == null ? null : request.eleBills());
              replaceMeterBills(
                  jdbcTemplate, "water_bill", "water_id", createdId, request == null ? null : request.waterBills());
              return createdId;
            });
    return findAmountBillDetail(jdbcTemplate, billId == null ? 0 : billId, authorizedParkIds);
  }

  /** 更新总账单主表和显式传入的水电明细；本批不直接同步 finance。 */
  public Map<String, Object> updateAmountBill(
      DataSource dataSource,
      int billId,
      AmountBillSaveRequest request,
      List<Integer> authorizedParkIds) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
    Set<String> billColumns = columnSet(jdbcTemplate, "amount_bill");
    if (!billColumns.containsAll(Set.of("bill_id", "project_name"))) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "总账单表未初始化，请先执行 db push");
    }
    Map<String, Object> existing = findAmountBillSnapshotForDelete(jdbcTemplate, billColumns, billId);
    if (existing == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "未找到ID为" + billId + "的账单记录");
    }
    Integer existingParkId = numberOrNull(existing.get("parkId"));
    if (existingParkId != null && existingParkId > 0 && !authorizedParkIds.contains(existingParkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    BillSaveData saveData = validateAndNormalizeBillSaveData(jdbcTemplate, request, authorizedParkIds, existingParkId);
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    transactionTemplate.executeWithoutResult(
        ignored -> {
          List<String> assignments = new ArrayList<>();
          List<Object> args = new ArrayList<>();
          appendBillUpdateAssignments(assignments, args, billColumns, saveData);
          if (!assignments.isEmpty()) {
            args.add(billId);
            jdbcTemplate.update(
                "UPDATE amount_bill SET " + String.join(", ", assignments) + " WHERE bill_id = ?",
                args.toArray());
          }
          if (request != null && request.eleBills() != null) {
            replaceMeterBills(jdbcTemplate, "ele_bill", "ele_id", billId, request.eleBills());
          }
          if (request != null && request.waterBills() != null) {
            replaceMeterBills(jdbcTemplate, "water_bill", "water_id", billId, request.waterBills());
          }
        });
    return findAmountBillDetail(jdbcTemplate, billId, authorizedParkIds);
  }

  /** 批量删除授权园区内总账单；不会执行旧端全库删除。 */
  public Map<String, Object> deleteAuthorizedAmountBills(
      DataSource dataSource, List<Integer> authorizedParkIds) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
    Set<String> billColumns = columnSet(jdbcTemplate, "amount_bill");
    if (!billColumns.contains("bill_id") || !billColumns.contains("park_id") || authorizedParkIds.isEmpty()) {
      return Map.of("deletedBillCount", 0, "deletedFinanceCount", 0);
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    return transactionTemplate.execute(
        ignored -> {
          List<Map<String, Object>> bills =
              jdbcTemplate.query(
                  "SELECT bill_id, finance_id FROM amount_bill WHERE park_id IN ("
                      + placeholders(authorizedParkIds.size())
                      + ")",
                  (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("billId", rs.getInt("bill_id"));
                    row.put("financeId", safeObject(rs, "finance_id"));
                    return row;
                  },
                  authorizedParkIds.toArray());
          List<Integer> billIds = bills.stream().map(row -> number(row.get("billId"))).filter(id -> id > 0).toList();
          List<Integer> financeIds =
              bills.stream().map(row -> numberOrNull(row.get("financeId"))).filter(Objects::nonNull).toList();
          if (billIds.isEmpty()) {
            return Map.of("deletedBillCount", 0, "deletedFinanceCount", 0);
          }
          for (Integer id : billIds) {
            deleteMeterBills(jdbcTemplate, "ele_bill", id);
            deleteMeterBills(jdbcTemplate, "water_bill", id);
          }
          jdbcTemplate.update(
              "DELETE FROM amount_bill WHERE bill_id IN (" + placeholders(billIds.size()) + ")",
              billIds.toArray());
          int deletedFinanceCount = 0;
          if (!financeIds.isEmpty() && hasColumn(jdbcTemplate, "finance", "is_deleted")) {
            deletedFinanceCount =
                jdbcTemplate.update(
                    "UPDATE finance SET is_deleted = true WHERE finance_id IN ("
                        + placeholders(financeIds.size())
                        + ")",
                    financeIds.toArray());
          }
          return Map.of("deletedBillCount", billIds.size(), "deletedFinanceCount", deletedFinanceCount);
        });
  }

  /** 暴露给发送兼容入口复用的账单 ID 归一化逻辑。 */
  public List<Integer> normalizeCollectionSmsBillIds(AmountBillCollectionSmsPreviewRequest request) {
    return normalizePositiveIds(request == null ? null : request.billIds());
  }

  /** 删除总账单、水电明细，并软删旧端关联的财务流水。 */
  public Map<String, Object> deleteAmountBill(
      DataSource dataSource, int billId, List<Integer> authorizedParkIds) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
    Set<String> billColumns = columnSet(jdbcTemplate, "amount_bill");
    if (!billColumns.contains("bill_id")) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "总账单表未初始化，请先执行 db push");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    return transactionTemplate.execute(
        ignored -> {
          Map<String, Object> bill = findAmountBillSnapshotForDelete(jdbcTemplate, billColumns, billId);
          if (bill == null) {
            return null;
          }
          Integer parkId = numberOrNull(bill.get("parkId"));
          if (parkId != null && parkId > 0 && !authorizedParkIds.contains(parkId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
          }
          deleteMeterBills(jdbcTemplate, "ele_bill", billId);
          deleteMeterBills(jdbcTemplate, "water_bill", billId);
          jdbcTemplate.update("DELETE FROM amount_bill WHERE bill_id = ?", billId);
          Integer financeId = numberOrNull(bill.get("financeId"));
          if (financeId != null && hasColumn(jdbcTemplate, "finance", "is_deleted")) {
            jdbcTemplate.update("UPDATE finance SET is_deleted = true WHERE finance_id = ?", financeId);
          }
          return bill;
        });
  }

  private Map<String, Object> exportBillMap(Map<String, Object> bill) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("tenantName", bill.get("tenantName"));
    map.put("factoryRent", bill.get("factoryRent"));
    map.put("waterFee", bill.get("waterFee"));
    map.put("eleFee", bill.get("eleFee"));
    map.put("serviceFee", bill.get("serviceFee"));
    map.put("managementFee", bill.get("managementFee"));
    map.put("invoiceTax", bill.get("invoiceTax"));
    map.put("receiveFee", bill.get("receiveFee"));
    map.put("garbageFee", bill.get("garbageFee"));
    map.put("penaltyFee", bill.get("penaltyFee"));
    map.put("totalFee", bill.get("totalFee"));
    return map;
  }

  private List<Map<String, Object>> listCollectionSmsBills(
      JdbcTemplate jdbcTemplate,
      CollectionSmsOptions options,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "amount_bill");
    if (!columns.containsAll(Set.of("bill_id", "project_name", "park_id"))
        || authorizedParkIds.isEmpty()) {
      return List.of();
    }

    boolean canJoinTenant = canJoinRentalTenant(jdbcTemplate, columns);
    boolean canReadTenantPhone = canJoinTenant && hasColumn(jdbcTemplate, "rental_tenant", "phone_number");
    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            "SELECT ab.*, "
                + tenantNameExpression(jdbcTemplate, columns)
                + " AS joinedTenantName, "
                + parkNameExpression(jdbcTemplate, columns)
                + " AS parkName, "
                + (canReadTenantPhone ? "rt.phone_number" : "NULL")
                + " AS phoneNumber FROM amount_bill ab ");
    if (canJoinTenant) {
      sql.append(" LEFT JOIN rental_tenant rt ON rt.rental_tenant_id = ab.tenant_id ");
    }
    if (canJoinPark(jdbcTemplate, columns)) {
      sql.append(" LEFT JOIN park p ON p.park_id = ab.park_id ");
    }

    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    if (!appendCollectionSmsParkScope(where, args, options.filters(), authorizedParkIds)) {
      return List.of();
    }
    if (!options.billIds().isEmpty()) {
      where.append(" AND ab.bill_id IN (").append(placeholders(options.billIds().size())).append(")");
      args.addAll(options.billIds());
    }
    appendLike(where, args, columns, "project_name", stringFilter(options.filters(), "projectName"), "ab");
    String tenantName = stringFilter(options.filters(), "tenantName");
    if (StringUtils.hasText(tenantName)) {
      List<String> conditions = new ArrayList<>();
      if (columns.contains("tenant_name")) {
        conditions.add("ab.tenant_name LIKE ?");
        args.add("%" + tenantName + "%");
      }
      if (canJoinTenant) {
        conditions.add("rt.tenant_name LIKE ?");
        args.add("%" + tenantName + "%");
      }
      if (!conditions.isEmpty()) {
        where.append(" AND (").append(String.join(" OR ", conditions)).append(")");
      }
    }

    String orderBy = columns.contains("create_time") ? "ab.create_time DESC, ab.bill_id DESC" : "ab.bill_id DESC";
    return jdbcTemplate.query(
        sql.append(" ").append(where).append(" ORDER BY ").append(orderBy).toString(),
        (rs, rowNum) -> {
          Map<String, Object> row = amountBillMap(rs, columns);
          row.put("phoneNumber", safeObject(rs, "phoneNumber"));
          return row;
        },
        args.toArray());
  }

  private boolean appendCollectionSmsParkScope(
      StringBuilder where,
      List<Object> args,
      Map<String, Object> filters,
      List<Integer> authorizedParkIds) {
    Integer requestedParkId =
        positiveInteger(firstNonNull(filters.get("parkId"), filters.get("currentPark")));
    if (requestedParkId != null) {
      if (!authorizedParkIds.contains(requestedParkId)) {
        return false;
      }
      where.append(" AND ab.park_id = ?");
      args.add(requestedParkId);
      return true;
    }
    where.append(" AND ab.park_id IN (").append(placeholders(authorizedParkIds.size())).append(")");
    args.addAll(authorizedParkIds);
    return true;
  }

  private Map<Integer, SmsLogSummary> findCollectionSmsLogSummaries(
      JdbcTemplate jdbcTemplate, List<Integer> billIds, String collectionType) {
    if (billIds.isEmpty()) {
      return Map.of();
    }
    Set<String> columns = columnSet(jdbcTemplate, "amount_bill_collection_sms_log");
    if (!columns.containsAll(Set.of("bill_id", "collection_type", "success", "sent_at"))) {
      return Map.of();
    }
    List<Object> args = new ArrayList<>();
    args.add(collectionType);
    args.addAll(billIds);
    Map<Integer, SmsLogSummary> result = new HashMap<>();
    jdbcTemplate.query(
        """
        SELECT bill_id, COUNT(*) AS sentCount, MAX(sent_at) AS lastSentAt
        FROM amount_bill_collection_sms_log
        WHERE success = 1
          AND collection_type = ?
          AND bill_id IN (
        """
            + placeholders(billIds.size())
            + """
            )
        GROUP BY bill_id
        """,
        rs -> {
          result.put(
              rs.getInt("bill_id"),
              new SmsLogSummary(rs.getInt("sentCount"), toIso(rs.getTimestamp("lastSentAt"))));
        },
        args.toArray());
    return result;
  }

  private Map<String, Object> collectionSmsCandidate(
      Map<String, Object> bill,
      CollectionSmsOptions options,
      Map<Integer, SmsLogSummary> logSummaries,
      Map<String, Map<String, String>> templateIdMap) {
    int billId = number(bill.get("billId"));
    double remainingAmount = roundAmount(amount(bill.get("remainingAmount")));
    double receiptAmount = roundAmount(amount(bill.get("receiptAmount")));
    double totalFee = roundAmount(amount(bill.get("totalFee")));
    String phoneNumber = normalizePhoneNumber(bill.get("phoneNumber"));
    String tenantName = defaultString(bill.get("tenantName")).trim();
    String parkName = defaultString(bill.get("parkName"));
    String candidateReason =
        collectionSmsCandidateReason(
            remainingAmount, numberOrNull(bill.get("tenantId")), phoneNumber);
    TemplateSelection templateSelection =
        resolveCollectionSmsTemplateSelection(
            options.collectionType(), parkName, bill.get("publicBankAccount"), templateIdMap);
    String reason =
        StringUtils.hasText(candidateReason) ? candidateReason : templateSelection.reason();
    SmsLogSummary logSummary = logSummaries.getOrDefault(billId, new SmsLogSummary(0, null));

    Map<String, Object> item = new LinkedHashMap<>();
    item.put("billId", billId);
    item.put("canSend", !StringUtils.hasText(reason));
    item.put("collectionType", options.collectionType());
    item.put("collectionStatus", defaultString(bill.get("collectionStatus")));
    item.put("collectionStatusLabel", defaultString(bill.get("collectionStatusLabel")));
    if (StringUtils.hasText(logSummary.lastSentAt())) {
      item.put("lastSentAt", logSummary.lastSentAt());
    }
    item.put(
        "message",
        buildCollectionSmsMessage(
            options.collectionType(),
            options.dueDate(),
            options.overdueDays(),
            defaultString(bill.get("projectName")),
            remainingAmount,
            tenantName));
    item.put("parkId", numberOrNull(bill.get("parkId")));
    item.put("parkName", parkName);
    item.put("phoneNumber", phoneNumber);
    item.put("projectName", defaultString(bill.get("projectName")));
    if (StringUtils.hasText(reason)) {
      item.put("reason", reason);
    }
    item.put("receiptAmount", receiptAmount);
    item.put("remainingAmount", remainingAmount);
    item.put("sentCount", logSummary.sentCount());
    if (StringUtils.hasText(templateSelection.companyName())) {
      item.put("smsCompanyName", templateSelection.companyName());
    }
    if (StringUtils.hasText(templateSelection.templateId())) {
      item.put("smsTemplateId", templateSelection.templateId());
    }
    item.put(
        "smsTemplateParamSet",
        buildCollectionSmsTemplateParamSet(
            options.collectionType(),
            options.dueDate(),
            options.overdueDays(),
            defaultString(bill.get("projectName")),
            remainingAmount,
            tenantName));
    item.put("tenantId", numberOrNull(bill.get("tenantId")));
    item.put("tenantName", tenantName);
    item.put("totalFee", totalFee);
    return item;
  }

  private Map<String, Object> collectionSmsOptionsMap(CollectionSmsOptions options) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("billIds", options.billIds());
    map.put("collectionType", options.collectionType());
    map.put("dueDate", options.dueDate());
    map.put("filters", options.filters());
    map.put("overdueDays", options.overdueDays());
    return map;
  }

  private Map<String, Object> collectionSmsSummary(List<Map<String, Object>> items) {
    double totalRemainingAmount = 0;
    int sendableCount = 0;
    for (Map<String, Object> item : items) {
      totalRemainingAmount += amount(item.get("remainingAmount"));
      if (Boolean.TRUE.equals(item.get("canSend"))) {
        sendableCount += 1;
      }
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("candidateCount", items.size());
    summary.put("sendableCount", sendableCount);
    summary.put("totalRemainingAmount", roundAmount(totalRemainingAmount));
    return summary;
  }

  private CollectionSmsOptions normalizeCollectionSmsOptions(
      AmountBillCollectionSmsPreviewRequest request) {
    Map<String, Object> filters = new LinkedHashMap<>();
    if (request != null && request.filters() != null) {
      filters.putAll(request.filters());
    }
    if (request != null && request.currentPark() != null) {
      filters.put("currentPark", request.currentPark());
    }
    String collectionType = normalizeCollectionType(request == null ? null : request.collectionType());
    return new CollectionSmsOptions(
        normalizePositiveIds(request == null ? null : request.billIds()),
        collectionType,
        normalizeDateText(request == null ? null : request.dueDate()),
        filters,
        normalizeOverdueDays(collectionType, request == null ? null : request.overdueDays()));
  }

  private String normalizeCollectionType(String value) {
    String type = value == null ? "" : value.trim();
    if ("final_30".equals(type) || "overdue_10".equals(type) || "payment_reminder".equals(type)) {
      return type;
    }
    return "payment_reminder";
  }

  private String normalizeCollectionStatus(Object value) {
    String status = defaultString(value).trim();
    return StringUtils.hasText(status) ? status : "unreceived";
  }

  private String normalizeDateText(Object value) {
    String text = defaultString(value).trim();
    if (!StringUtils.hasText(text)) {
      return "";
    }
    try {
      return LocalDate.parse(text.substring(0, Math.min(text.length(), 10))).toString();
    } catch (RuntimeException error) {
      return "";
    }
  }

  private int normalizeOverdueDays(String collectionType, Object value) {
    Integer overdueDays = positiveInteger(value);
    if (overdueDays != null) {
      return overdueDays;
    }
    return "final_30".equals(collectionType) ? 30 : 10;
  }

  private String collectionSmsCandidateReason(
      double remainingAmount, Integer tenantId, String phoneNumber) {
    if (remainingAmount <= 0) {
      return "账单已结清";
    }
    if (tenantId == null || tenantId <= 0) {
      return "账单未关联租户";
    }
    if (!StringUtils.hasText(phoneNumber)) {
      return "租户手机号为空";
    }
    if (!phoneNumber.matches("^1\\d{10}$")) {
      return "租户手机号格式不正确";
    }
    return "";
  }

  private TemplateSelection resolveCollectionSmsTemplateSelection(
      String collectionType,
      Object parkName,
      Object publicBankAccount,
      Map<String, Map<String, String>> templateIdMap) {
    String companyName =
        resolveCollectionSmsCompanyName(parkName, publicBankAccount, templateIdMap);
    if (!StringUtils.hasText(companyName)) {
      return new TemplateSelection("未匹配到短信企业主体", "", "");
    }
    String templateId =
        templateIdMap.getOrDefault(companyName, Map.of()).getOrDefault(collectionType, "");
    if (!StringUtils.hasText(templateId)) {
      return new TemplateSelection(
          companyName + "的" + COLLECTION_SMS_TYPE_LABELS.get(collectionType) + "模板未配置",
          companyName,
          "");
    }
    return new TemplateSelection("", companyName, templateId);
  }

  private String resolveCollectionSmsCompanyName(
      Object parkName,
      Object publicBankAccount,
      Map<String, Map<String, String>> templateIdMap) {
    String publicAccountName = parseBankAccountName(publicBankAccount);
    if (StringUtils.hasText(publicAccountName)
        && (COLLECTION_SMS_ENTERPRISE_COMPANY_NAMES.contains(publicAccountName)
            || templateIdMap.containsKey(publicAccountName))) {
      return publicAccountName;
    }
    if (StringUtils.hasText(publicAccountName)
        && !COLLECTION_SMS_PERSONAL_ACCOUNT_NAMES.contains(publicAccountName)) {
      return "";
    }
    return COLLECTION_SMS_PARK_COMPANY_NAME_MAP.getOrDefault(defaultString(parkName).trim(), "");
  }

  private String parseBankAccountName(Object value) {
    String raw = defaultString(value).trim();
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    try {
      Map<String, Object> parsed =
          OBJECT_MAPPER.readValue(raw, new TypeReference<Map<String, Object>>() {});
      return defaultString(parsed.get("name")).trim();
    } catch (RuntimeException | java.io.IOException error) {
      return raw;
    }
  }

  private Map<String, Map<String, String>> collectionSmsTemplateIdMap() {
    String raw = defaultString(System.getenv("SMS_COLLECTION_TEMPLATE_ID_MAP")).trim();
    if (!StringUtils.hasText(raw)) {
      return Map.of();
    }
    try {
      Map<String, Map<String, Object>> parsed =
          OBJECT_MAPPER.readValue(raw, new TypeReference<Map<String, Map<String, Object>>>() {});
      Map<String, Map<String, String>> result = new LinkedHashMap<>();
      parsed.forEach(
          (companyName, config) -> {
            if (!StringUtils.hasText(companyName) || config == null) {
              return;
            }
            Map<String, String> normalized = new LinkedHashMap<>();
            for (String type : COLLECTION_SMS_TYPE_LABELS.keySet()) {
              String templateId = defaultString(config.get(type)).trim();
              if (StringUtils.hasText(templateId)) {
                normalized.put(type, templateId);
              }
            }
            if (!normalized.isEmpty()) {
              result.put(companyName.trim(), normalized);
            }
          });
      return result;
    } catch (RuntimeException | java.io.IOException error) {
      return Map.of();
    }
  }

  private List<String> buildCollectionSmsTemplateParamSet(
      String collectionType,
      String dueDate,
      int overdueDays,
      String projectName,
      double remainingAmount,
      String tenantName) {
    return List.of(
        StringUtils.hasText(tenantName) ? tenantName : "贵司",
        resolveBillPeriod(projectName),
        formatMoney(remainingAmount),
        "payment_reminder".equals(collectionType)
            ? defaultDueDate(dueDate)
            : overdueDays + "天");
  }

  private String buildCollectionSmsMessage(
      String collectionType,
      String dueDate,
      int overdueDays,
      String projectName,
      double remainingAmount,
      String tenantName) {
    String normalizedTenantName = StringUtils.hasText(tenantName) ? tenantName : "贵司";
    String billPeriod = resolveBillPeriod(projectName);
    String amountText = formatMoney(remainingAmount);
    if ("final_30".equals(collectionType)) {
      return "租赁费用提醒："
          + normalizedTenantName
          + "您好，您"
          + billPeriod
          + "租赁费用已超过约定缴费时间"
          + overdueDays
          + "天，待结金额"
          + amountText
          + "元。请及时联系园区财务核对并完成缴费。如已处理请忽略。";
    }
    if ("overdue_10".equals(collectionType)) {
      return "租赁费用提醒："
          + normalizedTenantName
          + "您好，您"
          + billPeriod
          + "租赁费用已超过约定缴费时间"
          + overdueDays
          + "天，待结金额"
          + amountText
          + "元，请尽快完成核对和缴费。如已处理请忽略。";
    }
    return "租赁费用提醒："
        + normalizedTenantName
        + "您好，您"
        + billPeriod
        + "租赁费用未结清，待结金额"
        + amountText
        + "元，请于"
        + defaultDueDate(dueDate)
        + "前完成核对和缴费。如已处理请忽略。";
  }

  private String resolveBillPeriod(Object projectName) {
    String projectText = defaultString(projectName).trim();
    Matcher matcher = Pattern.compile("(\\d{4})[-年/._]?\\s*(\\d{1,2})").matcher(projectText);
    if (matcher.find()) {
      return matcher.group(1) + "年" + Integer.parseInt(matcher.group(2)) + "月";
    }
    return StringUtils.hasText(projectText) ? projectText : "本期";
  }

  private String defaultDueDate(String dueDate) {
    if (StringUtils.hasText(dueDate)) {
      return dueDate;
    }
    return LocalDate.now().withDayOfMonth(5).format(DateTimeFormatter.ISO_LOCAL_DATE);
  }

  private int compareCollectionSmsCandidates(Map<String, Object> left, Map<String, Object> right) {
    int sentRankDiff = sentRank(left) - sentRank(right);
    if (sentRankDiff != 0) {
      return sentRankDiff;
    }
    int sendableDiff = Boolean.compare(Boolean.TRUE.equals(right.get("canSend")), Boolean.TRUE.equals(left.get("canSend")));
    if (sendableDiff != 0) {
      return sendableDiff;
    }
    int sentTimeDiff = Long.compare(time(right.get("lastSentAt")), time(left.get("lastSentAt")));
    if (sentTimeDiff != 0) {
      return sentTimeDiff;
    }
    return Integer.compare(number(right.get("billId")), number(left.get("billId")));
  }

  private int sentRank(Map<String, Object> item) {
    return number(item.get("sentCount")) > 0 ? 1 : 0;
  }

  private Map<String, Object> findAmountBillSnapshotForDelete(
      JdbcTemplate jdbcTemplate, Set<String> billColumns, int billId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT ab.*, NULL AS joinedTenantName, NULL AS parkName, NULL AS parkManager
            FROM amount_bill ab
            WHERE ab.bill_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> amountBillMap(rs, billColumns),
            billId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void deleteMeterBills(JdbcTemplate jdbcTemplate, String tableName, int billId) {
    if (hasColumn(jdbcTemplate, tableName, "bill_id")) {
      jdbcTemplate.update("DELETE FROM " + tableName + " WHERE bill_id = ?", billId);
    }
  }

  private BillSaveData validateAndNormalizeBillSaveData(
      JdbcTemplate jdbcTemplate,
      AmountBillSaveRequest request,
      List<Integer> authorizedParkIds,
      Integer existingParkId) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "项目名称不能为空");
    }
    String projectName = clipText(request.projectName(), 120);
    if (!StringUtils.hasText(projectName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "项目名称不能为空");
    }
    String projectPeriodError = projectPeriodError(projectName);
    if (StringUtils.hasText(projectPeriodError)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, projectPeriodError);
    }

    Integer tenantId = positiveInteger(request.tenantId());
    String tenantName = clipText(request.tenantName(), 60);
    if (tenantId == null && !StringUtils.hasText(tenantName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户不能为空");
    }

    BigDecimal totalFee = decimalOrZero(request.totalFee());
    if (totalFee.compareTo(BigDecimal.ZERO) <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "本月收费金额必须大于0");
    }
    BigDecimal receiptAmount = decimalOrZero(request.receiptAmount());
    if (receiptAmount.compareTo(BigDecimal.ZERO) < 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "收款金额不能为负数");
    }
    Timestamp receiptTime = parseOptionalTimestamp(request.receiptTime(), "receiptTime参数错误");
    if (receiptAmount.compareTo(BigDecimal.ZERO) == 0) {
      receiptTime = null;
    } else if (receiptTime == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "已填写收款金额时，必须填写收款时间");
    }

    Integer parkId = resolveBillParkId(jdbcTemplate, request.parkId(), tenantId, existingParkId, authorizedParkIds);
    if (parkId != null && parkId > 0 && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }

    return new BillSaveData(
        projectName,
        tenantName,
        sanitizeBankAccount(request.publicBankAccount()),
        sanitizeBankAccount(request.privateBankAccount()),
        decimalOrNull(request.eleFee()),
        decimalOrNull(request.waterFee()),
        decimalOrNull(request.receiveFee()),
        decimalOrNull(request.factoryRent()),
        decimalOrNull(request.managementFee()),
        decimalOrNull(request.invoiceTax()),
        totalFee,
        decimalOrNull(request.serviceFee()),
        decimalOrNull(request.garbageFee()),
        receiptAmount,
        decimalOrNull(request.penaltyFee()),
        decimalOrNull(request.serviceRate()),
        decimalOrNull(request.garbageRate()),
        decimalOrNull(request.penaltyRate()),
        clipText(request.penaltyItem(), 200),
        decimalOrNull(request.extraEleRate()),
        clipText(request.extraEleItem(), 200),
        objectText(request.eleItem()),
        objectText(request.waterItem()),
        objectText(request.extraProjectItem()),
        objectText(request.taxRate()),
        clipText(request.remark(), 100),
        receiptTime,
        tenantId,
        parkId);
  }

  private void appendBillInsertColumns(
      List<String> columns, List<Object> args, Set<String> existingColumns, BillSaveData data) {
    appendInsert(columns, args, existingColumns, "project_name", data.projectName());
    appendInsert(columns, args, existingColumns, "tenant_name", data.tenantName());
    appendInsert(columns, args, existingColumns, "public_bank_account", data.publicBankAccount());
    appendInsert(columns, args, existingColumns, "private_bank_account", data.privateBankAccount());
    appendInsert(columns, args, existingColumns, "ele_fee", data.eleFee());
    appendInsert(columns, args, existingColumns, "water_fee", data.waterFee());
    appendInsert(columns, args, existingColumns, "receive_fee", data.receiveFee());
    appendInsert(columns, args, existingColumns, "factory_rent", data.factoryRent());
    appendInsert(columns, args, existingColumns, "management_fee", data.managementFee());
    appendInsert(columns, args, existingColumns, "invoice_tax", data.invoiceTax());
    appendInsert(columns, args, existingColumns, "total_fee", data.totalFee());
    appendInsert(columns, args, existingColumns, "service_fee", data.serviceFee());
    appendInsert(columns, args, existingColumns, "garbage_fee", data.garbageFee());
    appendInsert(columns, args, existingColumns, "receive_amount", data.receiptAmount());
    appendInsert(columns, args, existingColumns, "penalty_fee", data.penaltyFee());
    appendInsert(columns, args, existingColumns, "service_rate", data.serviceRate());
    appendInsert(columns, args, existingColumns, "garbage_rate", data.garbageRate());
    appendInsert(columns, args, existingColumns, "penalty_rate", data.penaltyRate());
    appendInsert(columns, args, existingColumns, "penalty_item", data.penaltyItem());
    appendInsert(columns, args, existingColumns, "extra_ele_rate", data.extraEleRate());
    appendInsert(columns, args, existingColumns, "extra_ele_item", data.extraEleItem());
    appendInsert(columns, args, existingColumns, "ele_item", data.eleItem());
    appendInsert(columns, args, existingColumns, "water_item", data.waterItem());
    appendInsert(columns, args, existingColumns, "project_amount_item", data.extraProjectItem());
    appendInsert(columns, args, existingColumns, "tax_rate", data.taxRate());
    appendInsert(columns, args, existingColumns, "remark", data.remark());
    appendInsert(columns, args, existingColumns, "receipt_time", data.receiptTime());
    appendInsert(columns, args, existingColumns, "tenant_id", data.tenantId());
    appendInsert(columns, args, existingColumns, "park_id", data.parkId());
    if (existingColumns.contains("create_time")) {
      columns.add("create_time");
      args.add(Timestamp.from(Instant.now()));
    }
    if (existingColumns.contains("update_time")) {
      columns.add("update_time");
      args.add(Timestamp.from(Instant.now()));
    }
  }

  private void appendBillUpdateAssignments(
      List<String> assignments, List<Object> args, Set<String> existingColumns, BillSaveData data) {
    appendAssignment(assignments, args, existingColumns, "project_name", data.projectName());
    appendAssignment(assignments, args, existingColumns, "tenant_name", data.tenantName());
    appendAssignment(assignments, args, existingColumns, "public_bank_account", data.publicBankAccount());
    appendAssignment(assignments, args, existingColumns, "private_bank_account", data.privateBankAccount());
    appendAssignment(assignments, args, existingColumns, "ele_fee", data.eleFee());
    appendAssignment(assignments, args, existingColumns, "water_fee", data.waterFee());
    appendAssignment(assignments, args, existingColumns, "receive_fee", data.receiveFee());
    appendAssignment(assignments, args, existingColumns, "factory_rent", data.factoryRent());
    appendAssignment(assignments, args, existingColumns, "management_fee", data.managementFee());
    appendAssignment(assignments, args, existingColumns, "invoice_tax", data.invoiceTax());
    appendAssignment(assignments, args, existingColumns, "total_fee", data.totalFee());
    appendAssignment(assignments, args, existingColumns, "service_fee", data.serviceFee());
    appendAssignment(assignments, args, existingColumns, "garbage_fee", data.garbageFee());
    appendAssignment(assignments, args, existingColumns, "receive_amount", data.receiptAmount());
    appendAssignment(assignments, args, existingColumns, "penalty_fee", data.penaltyFee());
    appendAssignment(assignments, args, existingColumns, "service_rate", data.serviceRate());
    appendAssignment(assignments, args, existingColumns, "garbage_rate", data.garbageRate());
    appendAssignment(assignments, args, existingColumns, "penalty_rate", data.penaltyRate());
    appendAssignment(assignments, args, existingColumns, "penalty_item", data.penaltyItem());
    appendAssignment(assignments, args, existingColumns, "extra_ele_rate", data.extraEleRate());
    appendAssignment(assignments, args, existingColumns, "extra_ele_item", data.extraEleItem());
    appendAssignment(assignments, args, existingColumns, "ele_item", data.eleItem());
    appendAssignment(assignments, args, existingColumns, "water_item", data.waterItem());
    appendAssignment(assignments, args, existingColumns, "project_amount_item", data.extraProjectItem());
    appendAssignment(assignments, args, existingColumns, "tax_rate", data.taxRate());
    appendAssignment(assignments, args, existingColumns, "remark", data.remark());
    appendAssignment(assignments, args, existingColumns, "receipt_time", data.receiptTime());
    appendAssignment(assignments, args, existingColumns, "tenant_id", data.tenantId());
    appendAssignment(assignments, args, existingColumns, "park_id", data.parkId());
    if (existingColumns.contains("update_time")) {
      assignments.add("update_time = ?");
      args.add(Timestamp.from(Instant.now()));
    }
  }

  private void replaceMeterBills(
      JdbcTemplate jdbcTemplate,
      String tableName,
      String idColumn,
      int billId,
      List<Map<String, Object>> rawBills) {
    Set<String> columns = columnSet(jdbcTemplate, tableName);
    if (!columns.containsAll(Set.of(idColumn, "bill_id", "meter_name"))) {
      return;
    }
    deleteMeterBills(jdbcTemplate, tableName, billId);
    if (rawBills == null || rawBills.isEmpty()) {
      return;
    }
    int index = 0;
    for (Map<String, Object> rawBill : rawBills) {
      String meterName = clipText(rawBill == null ? null : rawBill.get("meterName"), 120);
      if (!StringUtils.hasText(meterName) || "合计".equals(meterName)) {
        continue;
      }
      List<String> insertColumns = new ArrayList<>();
      List<Object> args = new ArrayList<>();
      appendInsert(insertColumns, args, columns, "bill_id", billId);
      appendInsert(insertColumns, args, columns, "meter_name", meterName);
      appendInsert(insertColumns, args, columns, "previous_reading", decimalOrNull(rawBill.get("previousReading")));
      appendInsert(insertColumns, args, columns, "current_reading", decimalOrNull(rawBill.get("currentReading")));
      appendInsert(insertColumns, args, columns, "monthly_usage", decimalOrNull(rawBill.get("monthlyUsage")));
      appendInsert(insertColumns, args, columns, "multiplier", decimalOrNull(rawBill.get("multiplier")));
      appendInsert(insertColumns, args, columns, "total_usage", decimalOrNull(rawBill.get("totalUsage")));
      appendInsert(insertColumns, args, columns, "unit_price", decimalOrNull(rawBill.get("unitPrice")));
      appendInsert(insertColumns, args, columns, "amount", decimalOrNull(rawBill.get("amount")));
      appendInsert(insertColumns, args, columns, "remark", clipText(rawBill.get("remark"), 100));
      appendInsert(insertColumns, args, columns, "receipt_time", parseOptionalTimestamp(rawBill.get("receiptTime"), "receiptTime参数错误"));
      if (columns.contains("create_time")) {
        insertColumns.add("create_time");
        args.add(Timestamp.from(Instant.now().plusSeconds(index)));
      }
      if (columns.contains("update_time")) {
        insertColumns.add("update_time");
        args.add(Timestamp.from(Instant.now().plusSeconds(index)));
      }
      jdbcTemplate.update(
          "INSERT INTO "
              + tableName
              + " ("
              + String.join(", ", insertColumns)
              + ") VALUES ("
              + placeholders(insertColumns.size())
              + ")",
          args.toArray());
      index += 1;
    }
  }

  private void appendInsert(
      List<String> columns, List<Object> args, Set<String> existingColumns, String column, Object value) {
    if (existingColumns.contains(column) && value != null) {
      columns.add(column);
      args.add(value);
    }
  }

  private void appendAssignment(
      List<String> assignments, List<Object> args, Set<String> existingColumns, String column, Object value) {
    if (existingColumns.contains(column)) {
      assignments.add(column + " = ?");
      args.add(value);
    }
  }

  private Integer resolveBillParkId(
      JdbcTemplate jdbcTemplate,
      Object rawParkId,
      Integer tenantId,
      Integer existingParkId,
      List<Integer> authorizedParkIds) {
    Integer requestedParkId = positiveInteger(rawParkId);
    if (requestedParkId != null) {
      return requestedParkId;
    }
    if (tenantId != null && hasColumns(jdbcTemplate, "rental_tenant", "rental_tenant_id", "park_id")) {
      List<Integer> tenantParkIds =
          jdbcTemplate.queryForList(
              "SELECT park_id FROM rental_tenant WHERE rental_tenant_id = ? LIMIT 1",
              Integer.class,
              tenantId);
      if (!tenantParkIds.isEmpty() && tenantParkIds.get(0) != null && tenantParkIds.get(0) > 0) {
        return tenantParkIds.get(0);
      }
    }
    if (existingParkId != null && existingParkId > 0) {
      return existingParkId;
    }
    return authorizedParkIds.isEmpty() ? null : authorizedParkIds.get(0);
  }

  private String projectPeriodError(String projectName) {
    String compact = compactProjectName(projectName);
    List<ProjectMonthReference> refs = parseProjectMonthReferences(projectName);
    if (refs.isEmpty()) {
      return "项目名称必须包含账期年月，如 2026年5月份房租水电";
    }
    long utilityMonths =
        refs.stream()
            .filter(ref -> hasUtilityKeyword(compact.substring(ref.end())))
            .map(ProjectMonthReference::key)
            .distinct()
            .count();
    long rentMonths =
        refs.stream()
            .filter(ref -> hasRentKeyword(compact.substring(ref.end())))
            .map(ProjectMonthReference::key)
            .distinct()
            .count();
    if (utilityMonths > 1) {
      return "项目名称只能包含一个水电账期月份，请将不同水电月份分开制单";
    }
    if (rentMonths > 1) {
      return "项目名称只能包含一个房租账期月份，请将不同房租月份分开制单";
    }
    return "";
  }

  private String clipText(Object value, int maxLength) {
    String text = defaultString(value).replaceAll("\\s+", " ").trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    return text.length() > maxLength ? text.substring(0, maxLength) : text;
  }

  private String objectText(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof String text) {
      return StringUtils.hasText(text) ? text.trim() : null;
    }
    try {
      return OBJECT_MAPPER.writeValueAsString(value);
    } catch (Exception error) {
      return String.valueOf(value);
    }
  }

  private String sanitizeBankAccount(Object value) {
    String text = defaultString(value).replaceAll("\\s+", " ").trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      Map<String, Object> parsed = OBJECT_MAPPER.readValue(text, new TypeReference<Map<String, Object>>() {});
      Map<String, Object> sanitized = new LinkedHashMap<>();
      sanitized.put("bank", clipText(parsed.get("bank"), 60));
      sanitized.put("name", clipText(parsed.get("name"), 60));
      sanitized.put("number", clipText(parsed.get("number"), 60));
      if (sanitized.values().stream().allMatch(Objects::isNull)) {
        return null;
      }
      return OBJECT_MAPPER.writeValueAsString(sanitized);
    } catch (Exception ignored) {
      return text.length() > 180 ? text.substring(0, 180) : text;
    }
  }

  private BigDecimal decimalOrNull(Object value) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    try {
      if (value instanceof BigDecimal decimal) {
        return decimal;
      }
      if (value instanceof Number number) {
        return BigDecimal.valueOf(number.doubleValue());
      }
      return new BigDecimal(String.valueOf(value).trim());
    } catch (RuntimeException error) {
      return null;
    }
  }

  private BigDecimal decimalOrZero(Object value) {
    BigDecimal decimal = decimalOrNull(value);
    return decimal == null ? BigDecimal.ZERO : decimal;
  }

  private Timestamp parseOptionalTimestamp(Object value, String message) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    String text = String.valueOf(value).trim();
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (RuntimeException ignored) {
      // Continue with local date/time formats from the old frontend.
    }
    try {
      String normalized = text.replace('T', ' ');
      if (normalized.length() == 10) {
        normalized += " 00:00:00";
      }
      return Timestamp.valueOf(LocalDateTime.parse(normalized.replace(' ', 'T')));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private List<Integer> normalizePositiveIds(Object value) {
    List<?> rawItems;
    if (value instanceof List<?> list) {
      rawItems = list;
    } else if (value instanceof String text && text.contains(",")) {
      rawItems = List.of(text.split(","));
    } else if (value == null) {
      rawItems = List.of();
    } else {
      rawItems = List.of(value);
    }
    return rawItems.stream()
        .map(this::positiveInteger)
        .filter(Objects::nonNull)
        .distinct()
        .toList();
  }

  private Integer positiveInteger(Object value) {
    if (value instanceof Number number) {
      int parsed = number.intValue();
      return parsed > 0 ? parsed : null;
    }
    if (value == null) {
      return null;
    }
    try {
      int parsed = Integer.parseInt(String.valueOf(value).trim());
      return parsed > 0 ? parsed : null;
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Integer numberOrNull(Object value) {
    return positiveInteger(value);
  }

  private Object firstNonNull(Object first, Object second) {
    return first != null ? first : second;
  }

  private String stringFilter(Map<String, Object> filters, String key) {
    return defaultString(filters.get(key)).trim();
  }

  private String normalizePhoneNumber(Object value) {
    return defaultString(value).replaceAll("\\D", "");
  }

  private String formatMoney(double value) {
    return String.format(Locale.ROOT, "%.2f", value);
  }

  private boolean appendParkFilter(
      StringBuilder where, List<Object> args, Integer requestedParkId, List<Integer> authorizedParkIds) {
    if (requestedParkId != null && requestedParkId > 0) {
      if (!authorizedParkIds.contains(requestedParkId)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
      }
      where.append(" AND ab.park_id = ?");
      args.add(requestedParkId);
      return true;
    }
    where.append(" AND ab.park_id IN (").append(placeholders(authorizedParkIds.size())).append(")");
    args.addAll(authorizedParkIds);
    return true;
  }

  private Map<String, Object> amountBillPage(
      List<Map<String, Object>> items, long total, Map<String, Object> summary) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("summary", summary);
    result.put("total", total);
    return result;
  }

  private Map<String, Object> amountBillMap(ResultSet rs, Set<String> columns)
      throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    putColumn(map, "billId", rs, columns, "bill_id");
    putColumn(map, "projectName", rs, columns, "project_name");
    putColumn(map, "tenantName", rs, columns, "tenant_name");
    Object joinedTenantName = safeObject(rs, "joinedTenantName");
    if (StringUtils.hasText(String.valueOf(joinedTenantName == null ? "" : joinedTenantName))) {
      map.put("tenantName", joinedTenantName);
    }
    putColumn(map, "publicBankAccount", rs, columns, "public_bank_account");
    putColumn(map, "privateBankAccount", rs, columns, "private_bank_account");
    putColumn(map, "eleFee", rs, columns, "ele_fee");
    putColumn(map, "waterFee", rs, columns, "water_fee");
    putColumn(map, "receiveFee", rs, columns, "receive_fee");
    putColumn(map, "factoryRent", rs, columns, "factory_rent");
    putColumn(map, "managementFee", rs, columns, "management_fee");
    putColumn(map, "invoiceTax", rs, columns, "invoice_tax");
    putColumn(map, "totalFee", rs, columns, "total_fee");
    putColumn(map, "serviceFee", rs, columns, "service_fee");
    putColumn(map, "garbageFee", rs, columns, "garbage_fee");
    putColumn(map, "receiptAmount", rs, columns, "receive_amount");
    putColumn(map, "penaltyFee", rs, columns, "penalty_fee");
    putColumn(map, "serviceRate", rs, columns, "service_rate");
    putColumn(map, "garbageRate", rs, columns, "garbage_rate");
    putColumn(map, "penaltyRate", rs, columns, "penalty_rate");
    putColumn(map, "penaltyItem", rs, columns, "penalty_item");
    putColumn(map, "extraEleRate", rs, columns, "extra_ele_rate");
    putColumn(map, "extraEleItem", rs, columns, "extra_ele_item");
    putColumn(map, "eleItem", rs, columns, "ele_item");
    putColumn(map, "waterItem", rs, columns, "water_item");
    putColumn(map, "extraProjectItem", rs, columns, "project_amount_item");
    putColumn(map, "taxRate", rs, columns, "tax_rate");
    putColumn(map, "remark", rs, columns, "remark");
    map.put("receiptTime", toIso(safeTimestamp(rs, "receipt_time")));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    putColumn(map, "financeId", rs, columns, "finance_id");
    putColumn(map, "tenantId", rs, columns, "tenant_id");
    putColumn(map, "parkId", rs, columns, "park_id");
    map.put("parkName", safeObject(rs, "parkName"));
    map.put("parkManager", safeObject(rs, "parkManager"));
    return map;
  }

  private Map<String, Object> enrichPaymentInfo(Map<String, Object> bill) {
    Map<String, Object> result = new LinkedHashMap<>(bill);
    double totalFee = amount(result.get("totalFee"));
    double receiptAmount = amount(result.get("receiptAmount"));
    String status = collectionStatus(totalFee, receiptAmount);
    result.put("collectionStatus", status);
    result.put("collectionStatusLabel", COLLECTION_STATUS_LABELS.get(status));
    result.put("overpaidAmount", roundAmount(Math.max(receiptAmount - totalFee, 0)));
    result.put("remainingAmount", roundAmount(Math.max(totalFee - receiptAmount, 0)));
    return result;
  }

  private boolean matchesCollectionStatus(Map<String, Object> bill, String collectionStatus) {
    if (!StringUtils.hasText(collectionStatus) || "all".equals(collectionStatus)) {
      return true;
    }
    String status = String.valueOf(bill.get("collectionStatus"));
    if ("unreceived".equals(collectionStatus)) {
      return "partial".equals(status) || "unpaid".equals(status);
    }
    return collectionStatus.equals(status);
  }

  private Map<String, Object> amountBillSummary(List<Map<String, Object>> items) {
    double invoiceTax = 0;
    double overpaidAmount = 0;
    double receiptAmount = 0;
    double remainingAmount = 0;
    double totalFee = 0;
    for (Map<String, Object> item : items) {
      invoiceTax += amount(item.get("invoiceTax"));
      overpaidAmount += amount(item.get("overpaidAmount"));
      receiptAmount += amount(item.get("receiptAmount"));
      remainingAmount += amount(item.get("remainingAmount"));
      totalFee += amount(item.get("totalFee"));
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("billCount", items.size());
    summary.put("invoiceTax", roundAmount(invoiceTax));
    summary.put("overpaidAmount", roundAmount(overpaidAmount));
    summary.put("receiptAmount", roundAmount(receiptAmount));
    summary.put("remainingAmount", roundAmount(remainingAmount));
    summary.put("totalFee", roundAmount(totalFee));
    return summary;
  }

  private Map<String, Object> emptySummary() {
    return amountBillSummary(List.of());
  }

  private List<Map<String, Object>> findMeterBills(
      JdbcTemplate jdbcTemplate, String tableName, String idColumn, int billId) {
    Set<String> columns = columnSet(jdbcTemplate, tableName);
    if (!columns.containsAll(Set.of(idColumn, "bill_id"))) {
      return List.of();
    }
    return jdbcTemplate.query(
        "SELECT * FROM "
            + tableName
            + " WHERE bill_id = ? ORDER BY "
            + (columns.contains("update_time") ? "update_time" : idColumn)
            + " ASC",
        (rs, rowNum) -> meterBillMap(rs, columns, idColumn),
        billId);
  }

  private Map<String, Object> meterBillMap(ResultSet rs, Set<String> columns, String idColumn)
      throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    putColumn(map, idColumn.equals("ele_id") ? "eleId" : "waterId", rs, columns, idColumn);
    putColumn(map, "billId", rs, columns, "bill_id");
    putColumn(map, "meterName", rs, columns, "meter_name");
    putColumn(map, "previousReading", rs, columns, "previous_reading");
    putColumn(map, "currentReading", rs, columns, "current_reading");
    putColumn(map, "monthlyUsage", rs, columns, "monthly_usage");
    putColumn(map, "multiplier", rs, columns, "multiplier");
    putColumn(map, "totalUsage", rs, columns, "total_usage");
    putColumn(map, "unitPrice", rs, columns, "unit_price");
    putColumn(map, "amount", rs, columns, "amount");
    putColumn(map, "remark", rs, columns, "remark");
    map.put("receiptTime", toIso(safeTimestamp(rs, "receipt_time")));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    return map;
  }

  private void appendLike(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String column,
      String value,
      String alias) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND ").append(alias).append(".").append(column).append(" LIKE ?");
      args.add("%" + value.trim() + "%");
    }
  }

  private void appendReceiptTimeRange(
      StringBuilder where, List<Object> args, Set<String> columns, String startTime, String endTime) {
    if (!columns.contains("receive_amount")
        || !columns.contains("receipt_time")
        || !StringUtils.hasText(startTime)
        || !StringUtils.hasText(endTime)) {
      return;
    }
    LocalDateTime start = parseDateTime(startTime, false);
    LocalDateTime end = parseDateTime(endTime, true);
    if (start == null || end == null) {
      return;
    }
    where.append(" AND ab.receive_amount > 0 AND ab.receipt_time >= ? AND ab.receipt_time <= ?");
    args.add(Timestamp.valueOf(start));
    args.add(Timestamp.valueOf(end));
  }

  private Map<String, Object> projectRecordMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("billId", rs.getInt("bill_id"));
    map.put("projectName", rs.getString("project_name"));
    map.put("receiptTime", toIso(safeTimestamp(rs, "receipt_time")));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    return map;
  }

  private boolean canJoinRentalTenant(JdbcTemplate jdbcTemplate, Set<String> amountBillColumns) {
    return amountBillColumns.contains("tenant_id")
        && hasColumns(jdbcTemplate, "rental_tenant", "rental_tenant_id", "tenant_name");
  }

  private boolean canJoinPark(JdbcTemplate jdbcTemplate, Set<String> amountBillColumns) {
    return amountBillColumns.contains("park_id") && hasColumn(jdbcTemplate, "park", "park_id");
  }

  private String tenantNameExpression(JdbcTemplate jdbcTemplate, Set<String> amountBillColumns) {
    boolean hasBillTenantName = amountBillColumns.contains("tenant_name");
    boolean canJoinTenant = canJoinRentalTenant(jdbcTemplate, amountBillColumns);
    if (hasBillTenantName && canJoinTenant) {
      return "COALESCE(NULLIF(rt.tenant_name, ''), ab.tenant_name)";
    }
    if (canJoinTenant) {
      return "rt.tenant_name";
    }
    if (hasBillTenantName) {
      return "ab.tenant_name";
    }
    return "NULL";
  }

  private String parkNameExpression(JdbcTemplate jdbcTemplate, Set<String> amountBillColumns) {
    return canJoinPark(jdbcTemplate, amountBillColumns) && hasColumn(jdbcTemplate, "park", "park_name")
        ? "p.park_name"
        : "NULL";
  }

  private String parkManagerExpression(JdbcTemplate jdbcTemplate, Set<String> amountBillColumns) {
    return canJoinPark(jdbcTemplate, amountBillColumns) && hasColumn(jdbcTemplate, "park", "manager")
        ? "p.manager"
        : "NULL";
  }

  private void putColumn(
      Map<String, Object> map, String key, ResultSet rs, Set<String> columns, String columnName)
      throws SQLException {
    map.put(key, columns.contains(columnName) ? rs.getObject(columnName) : null);
  }

  private Object safeObject(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String collectionStatus(double totalFee, double receiptAmount) {
    if (receiptAmount <= 0) {
      return "unpaid";
    }
    if (receiptAmount > totalFee) {
      return "overpaid";
    }
    if (receiptAmount < totalFee) {
      return "partial";
    }
    return "paid";
  }

  private double amount(Object value) {
    if (value instanceof Number number) {
      return number.doubleValue();
    }
    if (value == null) {
      return 0;
    }
    try {
      return Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException error) {
      return 0;
    }
  }

  private double roundAmount(double value) {
    return Math.round((value + Math.ulp(1.0)) * 100.0) / 100.0;
  }

  private MonthRange projectMonthRange(String startValue, String endValue) {
    Integer startKey = dateMonthKey(startValue);
    Integer endKey = dateMonthKey(endValue);
    if (startKey == null || endKey == null) {
      return null;
    }
    return new MonthRange(Math.min(startKey, endKey), Math.max(startKey, endKey));
  }

  private boolean projectMonthInRange(Object projectName, MonthRange range) {
    if (range == null) {
      return true;
    }
    int monthKey = singleProjectMonthSortKey(projectName, parseProjectMonthSortKeys(projectName));
    return monthKey >= range.startKey() && monthKey <= range.endKey();
  }

  private Integer dateMonthKey(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      LocalDate date = LocalDate.parse(value.trim().substring(0, 10));
      return date.getYear() * 12 + date.getMonthValue();
    } catch (RuntimeException error) {
      return null;
    }
  }

  private LocalDateTime parseDateTime(String value, boolean endOfDay) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      String text = value.trim();
      if (text.length() <= 10) {
        return LocalDate.parse(text.substring(0, 10))
            .atTime(endOfDay ? LocalTime.MAX.withNano(0) : LocalTime.MIN);
      }
      return LocalDateTime.parse(text.replace(" ", "T").substring(0, 19));
    } catch (RuntimeException error) {
      try {
        return LocalDate.parse(value.trim().substring(0, 10))
            .atTime(endOfDay ? LocalTime.MAX.withNano(0) : LocalTime.MIN);
      } catch (RuntimeException ignored) {
        return null;
      }
    }
  }

  private int normalizePage(Integer value) {
    return value == null || value < 1 ? 1 : value;
  }

  private int normalizePageSize(Integer value) {
    return value == null || value < 1 ? 20 : Math.min(value, 200);
  }

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private boolean hasColumns(JdbcTemplate jdbcTemplate, String tableName, String... columns) {
    Set<String> columnSet = columnSet(jdbcTemplate, tableName);
    for (String column : columns) {
      if (!columnSet.contains(column.toLowerCase(Locale.ROOT))) {
        return false;
      }
    }
    return true;
  }

  private boolean hasColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
    return columnSet(jdbcTemplate, tableName).contains(columnName.toLowerCase(Locale.ROOT));
  }

  private Comparator<Map<String, Object>> projectComparator() {
    return (left, right) -> compareProjectRows(left, right);
  }

  private int compareProjectRows(Map<String, Object> left, Map<String, Object> right) {
    List<Integer> leftKeys = parseProjectMonthSortKeys(left.get("projectName"));
    List<Integer> rightKeys = parseProjectMonthSortKeys(right.get("projectName"));
    boolean leftHasProjectMonth = !leftKeys.isEmpty();
    boolean rightHasProjectMonth = !rightKeys.isEmpty();
    if (leftHasProjectMonth != rightHasProjectMonth) {
      return leftHasProjectMonth ? -1 : 1;
    }
    if (leftHasProjectMonth) {
      int leftPrimary = singleProjectMonthSortKey(left.get("projectName"), leftKeys);
      int rightPrimary = singleProjectMonthSortKey(right.get("projectName"), rightKeys);
      if (leftPrimary != rightPrimary) {
        return Integer.compare(rightPrimary, leftPrimary);
      }
      List<Integer> leftSecondary = leftKeys.stream().skip(1).sorted(Comparator.reverseOrder()).toList();
      List<Integer> rightSecondary = rightKeys.stream().skip(1).sorted(Comparator.reverseOrder()).toList();
      int maxLength = Math.max(leftSecondary.size(), rightSecondary.size());
      for (int index = 0; index < maxLength; index += 1) {
        int leftKey = index < leftSecondary.size() ? leftSecondary.get(index) : 0;
        int rightKey = index < rightSecondary.size() ? rightSecondary.get(index) : 0;
        if (leftKey != rightKey) {
          return Integer.compare(rightKey, leftKey);
        }
      }
    }
    int receiptDiff = Long.compare(time(right.get("receiptTime")), time(left.get("receiptTime")));
    if (receiptDiff != 0) {
      return receiptDiff;
    }
    int createDiff = Long.compare(time(right.get("createTime")), time(left.get("createTime")));
    if (createDiff != 0) {
      return createDiff;
    }
    return Integer.compare(number(right.get("billId")), number(left.get("billId")));
  }

  private int singleProjectMonthSortKey(Object value, List<Integer> matchedKeys) {
    List<Integer> utilityKeys = parseProjectKeywordMonthSortKeys(value, this::hasUtilityKeyword);
    if (utilityKeys.size() == 1) {
      return utilityKeys.get(0);
    }
    List<Integer> rentKeys = parseProjectKeywordMonthSortKeys(value, this::hasRentKeyword);
    if (rentKeys.size() == 1) {
      return rentKeys.get(0);
    }
    return matchedKeys.isEmpty() ? 0 : matchedKeys.get(0);
  }

  private List<Integer> parseProjectMonthSortKeys(Object value) {
    return parseProjectMonthReferences(value).stream()
        .map(ProjectMonthReference::key)
        .distinct()
        .toList();
  }

  private List<Integer> parseProjectKeywordMonthSortKeys(
      Object value, java.util.function.Predicate<String> keywordPredicate) {
    String compactText = compactProjectName(value);
    List<ProjectMonthReference> references = parseProjectMonthReferences(value);
    if (!StringUtils.hasText(compactText) || references.isEmpty()) {
      return List.of();
    }
    List<Integer> matchedKeys = new ArrayList<>();
    for (int index = 0; index < references.size(); index += 1) {
      ProjectMonthReference current = references.get(index);
      ProjectMonthReference next = index + 1 < references.size() ? references.get(index + 1) : null;
      String segmentAfterMonth =
          compactText.substring(current.end(), next == null ? compactText.length() : next.start());
      if (keywordPredicate.test(segmentAfterMonth)) {
        matchedKeys.add(current.key());
      }
    }
    if (matchedKeys.isEmpty()) {
      for (String segment : compactText.split("[、,，;；]")) {
        if (!keywordPredicate.test(segment)) {
          continue;
        }
        List<Integer> segmentKeys = parseProjectMonthReferences(segment).stream().map(ProjectMonthReference::key).toList();
        if (segmentKeys.size() == 1) {
          matchedKeys.add(segmentKeys.get(0));
        }
      }
    }
    return matchedKeys.stream().distinct().toList();
  }

  private List<ProjectMonthReference> parseProjectMonthReferences(Object value) {
    String compactText = compactProjectName(value);
    if (!StringUtils.hasText(compactText)) {
      return List.of();
    }
    List<ProjectMonthReference> references = new ArrayList<>();
    Matcher separated = SEPARATED_MONTH_PATTERN.matcher(compactText);
    while (separated.find()) {
      Integer key = toMonthSortKey(separated.group(1), separated.group(2));
      if (key != null) {
        references.add(new ProjectMonthReference(separated.start(), separated.end(), key));
      }
    }
    Matcher compact = COMPACT_MONTH_PATTERN.matcher(compactText);
    while (compact.find()) {
      Integer key = toMonthSortKey(compact.group(1), compact.group(2));
      if (key != null && references.stream().noneMatch(item -> compact.start() < item.end() && compact.end() > item.start())) {
        references.add(new ProjectMonthReference(compact.start(), compact.end(), key));
      }
    }
    references.sort(Comparator.comparingInt(ProjectMonthReference::start));
    return references;
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

  private boolean hasRentKeyword(String value) {
    return value.matches(".*(房租|租金|租赁费).*");
  }

  private boolean hasUtilityKeyword(String value) {
    return value.matches(".*(水费|电费|水[、,，]?电|用水|用电).*");
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

  private String normalizeProjectName(Object value) {
    return String.valueOf(value == null ? "" : value).replaceAll("\\s+", " ").trim();
  }

  private String compactProjectName(Object value) {
    return normalizeProjectName(value).replaceAll("\\s+", "");
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private Timestamp safeTimestamp(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getTimestamp(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private long time(Object value) {
    if (value == null) {
      return 0;
    }
    try {
      return java.time.Instant.parse(String.valueOf(value)).toEpochMilli();
    } catch (RuntimeException error) {
      return 0;
    }
  }

  private int number(Object value) {
    return value instanceof Number number ? number.intValue() : 0;
  }

  private record ProjectMonthReference(int start, int end, int key) {}

  private record MonthRange(int startKey, int endKey) {}

  private record CollectionSmsOptions(
      List<Integer> billIds,
      String collectionType,
      String dueDate,
      Map<String, Object> filters,
      int overdueDays) {}

  private record BillSaveData(
      String projectName,
      String tenantName,
      String publicBankAccount,
      String privateBankAccount,
      BigDecimal eleFee,
      BigDecimal waterFee,
      BigDecimal receiveFee,
      BigDecimal factoryRent,
      BigDecimal managementFee,
      BigDecimal invoiceTax,
      BigDecimal totalFee,
      BigDecimal serviceFee,
      BigDecimal garbageFee,
      BigDecimal receiptAmount,
      BigDecimal penaltyFee,
      BigDecimal serviceRate,
      BigDecimal garbageRate,
      BigDecimal penaltyRate,
      String penaltyItem,
      BigDecimal extraEleRate,
      String extraEleItem,
      String eleItem,
      String waterItem,
      String extraProjectItem,
      String taxRate,
      String remark,
      Timestamp receiptTime,
      Integer tenantId,
      Integer parkId) {}

  private record SmsLogSummary(int sentCount, String lastSentAt) {}

  private record TemplateSelection(String reason, String companyName, String templateId) {}
}
