package cn.yizuw.magic.backend.dashboard.overview;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 经营看板只读数据访问层。
 *
 * <p>这些接口跨厂房、租户、招商和账单表做统计，迁移期优先使用 JdbcTemplate 兼容租户库 schema 漂移。
 */
@Repository
public class DashboardOverviewRepository {

  /** 查询指定园区和截止日期前的厂房楼层面积。 */
  public List<FactoryFloorUsageRow> findFactoryFloorUsage(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds, Instant periodEnd) {
    if (parkIds.isEmpty()
        || !hasColumns(jdbcTemplate, "factory_floor", "factory_id", "total_area", "used_area", "is_deleted")
        || !hasColumns(jdbcTemplate, "factory", "factory_id", "park_id", "create_time", "is_deleted")
        || !hasColumns(jdbcTemplate, "park", "park_id", "is_deleted")) {
      return List.of();
    }

    String floorCreateTimeFilter =
        hasColumn(jdbcTemplate, "factory_floor", "create_time") ? "AND ff.create_time < ?" : "";
    List<Object> args = new ArrayList<>();
    args.add(Timestamp.from(periodEnd));
    if (!floorCreateTimeFilter.isBlank()) {
      args.add(Timestamp.from(periodEnd));
    }
    args.addAll(parkIds);

    return jdbcTemplate.query(
        """
        SELECT ff.total_area, ff.used_area
        FROM factory_floor ff
        INNER JOIN factory f ON f.factory_id = ff.factory_id
        INNER JOIN park p ON p.park_id = f.park_id
        WHERE ff.is_deleted = false
          AND f.is_deleted = false
          AND p.is_deleted = false
          AND f.create_time < ?
        """
            + floorCreateTimeFilter
            + """
          AND p.park_id IN (
        """
            + placeholders(parkIds.size())
            + """
          )
        """,
        (rs, rowNum) -> new FactoryFloorUsageRow(decimal(rs, "total_area"), decimal(rs, "used_area")),
        args.toArray());
  }

  /** 查询租赁合同开始/结束日期，用于合同状态和趋势统计。 */
  public List<ContractDateRow> findContractDates(JdbcTemplate jdbcTemplate, List<Integer> parkIds) {
    if (parkIds.isEmpty()
        || !hasColumns(
            jdbcTemplate, "rental_tenant", "rental_tenant_id", "park_id", "contract_start", "contract_end", "is_deleted")) {
      return List.of();
    }

    List<Object> args = new ArrayList<>(parkIds);
    return jdbcTemplate.query(
        """
        SELECT contract_start, contract_end
        FROM rental_tenant
        WHERE is_deleted = false
          AND park_id IN (
        """
            + placeholders(parkIds.size())
            + """
          )
        """,
        (rs, rowNum) -> new ContractDateRow(timestamp(rs, "contract_start"), timestamp(rs, "contract_end")),
        args.toArray());
  }

  /** 查询真实成交租户合同日期，用于旧 `/analytics/contract-overview` 的 90 天到期统计。 */
  public List<ContractDateRow> findAnalyticsContractDates(JdbcTemplate jdbcTemplate, List<Integer> parkIds) {
    if (parkIds.isEmpty()
        || !hasColumns(
            jdbcTemplate,
            "rental_tenant",
            "rental_tenant_id",
            "park_id",
            "contract_start",
            "contract_end",
            "transaction_type",
            "is_deleted")) {
      return List.of();
    }

    List<Object> args = new ArrayList<>(parkIds);
    return jdbcTemplate.query(
        """
        SELECT contract_start, contract_end
        FROM rental_tenant
        WHERE is_deleted = false
          AND transaction_type = true
          AND park_id IN (
        """
            + placeholders(parkIds.size())
            + """
          )
        """,
        (rs, rowNum) -> new ContractDateRow(timestamp(rs, "contract_start"), timestamp(rs, "contract_end")),
        args.toArray());
  }

  /** 查询招商线索，用于客户总览统计。 */
  public List<InvestmentOverviewRow> findInvestments(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds, Instant periodStart, Instant periodEnd) {
    if (parkIds.isEmpty()
        || !hasColumns(jdbcTemplate, "investment", "park_id", "intent_level", "progress", "meeting_time")) {
      return List.of();
    }

    List<Object> args = new ArrayList<>();
    args.add(Timestamp.from(periodStart));
    args.add(Timestamp.from(periodEnd));
    args.addAll(parkIds);
    return jdbcTemplate.query(
        """
        SELECT intent_level, progress, meeting_time
        FROM investment
        WHERE meeting_time >= ?
          AND meeting_time < ?
          AND park_id IN (
        """
            + placeholders(parkIds.size())
            + """
          )
        """,
        (rs, rowNum) ->
            new InvestmentOverviewRow(
                string(rs, "intent_level"), string(rs, "progress"), timestamp(rs, "meeting_time")),
        args.toArray());
  }

  /** 查询总账单及可用的旧水电明细表，Service 再负责 JSON/明细的口径归并。 */
  public List<EnergyBillRow> findEnergyBills(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds, Instant createTimeStart, Instant createTimeEnd) {
    if (parkIds.isEmpty()
        || !hasColumns(jdbcTemplate, "amount_bill", "bill_id", "park_id", "create_time")) {
      return List.of();
    }

    Set<String> amountBillColumns = columnSet(jdbcTemplate, "amount_bill");
    boolean hasEleItem = amountBillColumns.contains("ele_item");
    boolean hasWaterItem = amountBillColumns.contains("water_item");
    List<Object> args = new ArrayList<>();
    args.add(Timestamp.from(createTimeStart));
    args.add(Timestamp.from(createTimeEnd));
    args.addAll(parkIds);

    List<EnergyBillRow> bills =
        jdbcTemplate.query(
            "SELECT bill_id, create_time"
                + (hasEleItem ? ", ele_item" : ", NULL AS ele_item")
                + (hasWaterItem ? ", water_item" : ", NULL AS water_item")
                + " FROM amount_bill WHERE create_time >= ? AND create_time < ? AND park_id IN ("
                + placeholders(parkIds.size())
                + ")",
            (rs, rowNum) ->
                new EnergyBillRow(
                    rs.getInt("bill_id"),
                    timestamp(rs, "create_time"),
                    string(rs, "ele_item"),
                    string(rs, "water_item"),
                    new ArrayList<>(),
                    new ArrayList<>()),
            args.toArray());
    if (bills.isEmpty()) {
      return List.of();
    }

    Map<Integer, EnergyBillRow> billsById = new LinkedHashMap<>();
    for (EnergyBillRow bill : bills) {
      billsById.put(bill.billId(), bill);
    }
    appendMeterBills(jdbcTemplate, "ele_bill", billsById, true);
    appendMeterBills(jdbcTemplate, "water_bill", billsById, false);
    return bills;
  }

  /** 查询营收看板所需总账单。项目账期月份由 Service 解析，Repository 只下推园区过滤。 */
  public List<RevenueBillRow> findRevenueBills(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds, List<String> projectMonthValues) {
    if (parkIds.isEmpty()
        || projectMonthValues.isEmpty()
        || !hasColumns(
            jdbcTemplate,
            "amount_bill",
            "bill_id",
            "park_id",
            "project_name",
            "receipt_amount",
            "total_fee")) {
      return List.of();
    }
    List<Object> args = new ArrayList<>(parkIds);
    List<String> projectNameConditions = new ArrayList<>();
    for (String value : projectMonthValues) {
      projectNameConditions.add("project_name LIKE ?");
      args.add("%" + value + "%");
    }
    return jdbcTemplate.query(
        """
        SELECT bill_id, project_name, receipt_amount, total_fee
        FROM amount_bill
        WHERE park_id IN (
        """
            + placeholders(parkIds.size())
            + """
        )
          AND (
        """
            + String.join(" OR ", projectNameConditions)
            + """
          )
        """,
        (rs, rowNum) ->
            new RevenueBillRow(
                rs.getInt("bill_id"),
                string(rs, "project_name"),
                decimal(rs, "receipt_amount"),
                decimal(rs, "total_fee")),
        args.toArray());
  }

  /** 查询现有财务流水；旧端会先同步租赁费用，Spring Boot 本批只统计当前已落库数据。 */
  public List<FinanceRevenueRow> findFinanceRevenueRows(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds, Instant start, Instant end) {
    if (parkIds.isEmpty()
        || !hasColumns(
            jdbcTemplate,
            "finance",
            "park_id",
            "amount",
            "transaction_time",
            "transaction_type",
            "is_deleted")) {
      return List.of();
    }
    List<Object> args = new ArrayList<>();
    args.add(Timestamp.from(start));
    args.add(Timestamp.from(end));
    args.addAll(parkIds);
    return jdbcTemplate.query(
        """
        SELECT amount, transaction_time, transaction_type
        FROM finance
        WHERE is_deleted = false
          AND transaction_time >= ?
          AND transaction_time < ?
          AND transaction_type IN ('收入', '支出')
          AND park_id IN (
        """
            + placeholders(parkIds.size())
            + """
        )
        ORDER BY transaction_time ASC
        """,
        (rs, rowNum) ->
            new FinanceRevenueRow(
                decimal(rs, "amount"),
                timestamp(rs, "transaction_time"),
                string(rs, "transaction_type")),
        args.toArray());
  }

  private void appendMeterBills(
      JdbcTemplate jdbcTemplate, String tableName, Map<Integer, EnergyBillRow> billsById, boolean electricity) {
    if (billsById.isEmpty() || !hasColumns(jdbcTemplate, tableName, "bill_id", "meter_name", "total_usage")) {
      return;
    }
    List<Integer> billIds = new ArrayList<>(billsById.keySet());
    jdbcTemplate
        .query(
            """
            SELECT bill_id, meter_name, total_usage
            FROM
            """
                + tableName
                + """
            WHERE bill_id IN (
            """
                + placeholders(billIds.size())
                + """
            )
            """,
            (rs, rowNum) ->
                new MeterBillRow(rs.getInt("bill_id"), string(rs, "meter_name"), decimal(rs, "total_usage")),
            billIds.toArray())
        .forEach(
            meterBill -> {
              EnergyBillRow owner = billsById.get(meterBill.billId());
              if (owner == null) {
                return;
              }
              if (electricity) {
                owner.eleBills().add(meterBill);
              } else {
                owner.waterBills().add(meterBill);
              }
            });
  }

  private boolean hasColumns(JdbcTemplate jdbcTemplate, String tableName, String... columns) {
    Set<String> currentColumns = columnSet(jdbcTemplate, tableName);
    for (String column : columns) {
      if (!currentColumns.contains(column.toLowerCase(Locale.ROOT))) {
        return false;
      }
    }
    return true;
  }

  private boolean hasColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
    return columnSet(jdbcTemplate, tableName).contains(columnName.toLowerCase(Locale.ROOT));
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
    if (count <= 0) {
      return "NULL";
    }
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private String string(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getString(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private BigDecimal decimal(ResultSet rs, String columnName) throws SQLException {
    try {
      BigDecimal value = rs.getBigDecimal(columnName);
      return value == null ? BigDecimal.ZERO : value;
    } catch (SQLException error) {
      return BigDecimal.ZERO;
    }
  }

  private Instant timestamp(ResultSet rs, String columnName) throws SQLException {
    try {
      Timestamp value = rs.getTimestamp(columnName);
      return value == null ? null : value.toInstant();
    } catch (SQLException error) {
      return null;
    }
  }

  public record ContractDateRow(Instant contractStart, Instant contractEnd) {}

  public record EnergyBillRow(
      int billId,
      Instant createTime,
      String eleItem,
      String waterItem,
      List<MeterBillRow> eleBills,
      List<MeterBillRow> waterBills) {}

  public record FactoryFloorUsageRow(BigDecimal totalArea, BigDecimal usedArea) {}

  public record FinanceRevenueRow(
      BigDecimal amount, Instant transactionTime, String transactionType) {}

  public record InvestmentOverviewRow(String intentLevel, String progress, Instant meetingTime) {}

  public record MeterBillRow(int billId, String meterName, BigDecimal totalUsage) {}

  public record RevenueBillRow(
      int billId, String projectName, BigDecimal receiptAmount, BigDecimal totalFee) {}
}
