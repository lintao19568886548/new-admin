package cn.yizuw.magic.backend.dashboard.overview;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.dashboard.overview.DashboardDateUtils.DateRange;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.ContractDateRow;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.EnergyBillRow;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.FactoryFloorUsageRow;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.FinanceRevenueRow;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.InvestmentOverviewRow;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.MeterBillRow;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.RevenueBillRow;
import cn.yizuw.magic.backend.integration.hezhong.HezhongClient;
import cn.yizuw.magic.backend.integration.hezhong.HezhongMeterType;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 经营看板统计业务层。
 *
 * <p>Service 负责复刻旧 Nitro 接口统计口径，Repository 只做租户库只读查询，便于每批迁移后单独验收。
 */
@Service
@Transactional(readOnly = true)
public class DashboardOverviewService {

  private static final List<String> INTENT_LEVELS = List.of("很高", "高", "一般", "低", "很低");
  private static final String DEFAULT_METER_PROJ_CODE = "241";
  private static final DateTimeFormatter METER_TIME_FORMATTER =
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  private static final String THIRD_PARTY_UNAVAILABLE_MESSAGE =
      "表计平台响应超时，已返回本地可用统计数据";

  private final DashboardOverviewRepository dashboardOverviewRepository;
  private final HezhongClient hezhongClient;
  private final ObjectMapper objectMapper;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public DashboardOverviewService(
      DashboardOverviewRepository dashboardOverviewRepository,
      HezhongClient hezhongClient,
      ObjectMapper objectMapper,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.dashboardOverviewRepository = dashboardOverviewRepository;
    this.hezhongClient = hezhongClient;
    this.objectMapper = objectMapper;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** 统计楼层总面积、已租面积、空置面积和租赁率。 */
  public Map<String, Object> getFactoryRentalStats(DashboardOverviewQuery query) {
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks() || !context.hasRequestedScope()) {
      return emptyFactoryRentalStats();
    }

    LocalDate referenceDate =
        DashboardDateUtils.referenceDate(firstText(query.endDate(), query.date()));
    Instant periodEnd = referenceDate.plusDays(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    List<FactoryFloorUsageRow> floors =
        dashboardOverviewRepository.findFactoryFloorUsage(
            context.jdbcTemplate(), context.parkIds(), periodEnd);

    BigDecimal totalArea = BigDecimal.ZERO;
    BigDecimal rentedArea = BigDecimal.ZERO;
    BigDecimal vacantArea = BigDecimal.ZERO;
    int rentedCount = 0;
    int vacantCount = 0;
    int partialCount = 0;
    int overusedCount = 0;
    int invalidTotalAreaCount = 0;

    for (FactoryFloorUsageRow floor : floors) {
      BigDecimal floorTotalArea = positive(floor.totalArea());
      BigDecimal floorUsedArea = positive(floor.usedArea());
      BigDecimal floorVacantArea = floorTotalArea.subtract(floorUsedArea).max(BigDecimal.ZERO);

      if (floorTotalArea.compareTo(BigDecimal.ZERO) <= 0) {
        invalidTotalAreaCount += 1;
      }
      totalArea = totalArea.add(floorTotalArea);
      rentedArea = rentedArea.add(floorUsedArea);
      vacantArea = vacantArea.add(floorVacantArea);

      if (floorVacantArea.compareTo(BigDecimal.ZERO) <= 0) {
        rentedCount += 1;
      } else {
        vacantCount += 1;
      }
      if (floorUsedArea.compareTo(BigDecimal.ZERO) > 0
          && floorVacantArea.compareTo(BigDecimal.ZERO) > 0) {
        partialCount += 1;
      }
      if (floorUsedArea.compareTo(floorTotalArea) > 0) {
        overusedCount += 1;
      }
    }

    BigDecimal rentalRate =
        totalArea.compareTo(BigDecimal.ZERO) > 0
            ? rentedArea.multiply(BigDecimal.valueOf(100)).divide(totalArea, 4, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
    Map<String, Object> stats = new LinkedHashMap<>();
    stats.put("invalidTotalAreaCount", invalidTotalAreaCount);
    stats.put("overusedCount", overusedCount);
    stats.put("partialCount", partialCount);
    stats.put("rentalRate", fixed2(rentalRate));
    stats.put("rentedArea", fixed2(rentedArea));
    stats.put("rentedCount", rentedCount);
    stats.put("totalArea", fixed2(totalArea));
    stats.put("totalCount", floors.size());
    stats.put("vacantArea", fixed2(vacantArea));
    stats.put("vacantCount", vacantCount);
    return stats;
  }

  /** 统计合同到期、新增、正常和已退租数量，并生成按月趋势。 */
  public Map<String, Object> getContractStats(DashboardOverviewQuery query) {
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks() || !context.hasRequestedScope()) {
      return emptyContractStats();
    }

    List<ContractDateRow> contracts =
        dashboardOverviewRepository.findContractDates(context.jdbcTemplate(), context.parkIds());
    boolean hasDateRange = StringUtils.hasText(query.startDate()) || StringUtils.hasText(query.endDate());
    DateRange dateRange =
        hasDateRange ? DashboardDateUtils.dateRange(query.startDate(), query.endDate()) : null;
    LocalDate now =
        dateRange == null
            ? DashboardDateUtils.referenceDate(query.date())
            : dateRange.periodEndDate();

    YearMonth rangeStartMonth =
        dateRange == null ? null : YearMonth.from(dateRange.periodStartDate());
    List<YearMonth> trendMonths =
        rangeStartMonth == null
            ? DashboardDateUtils.currentYearMonths(now)
            : DashboardDateUtils.currentYearMonths(now).stream()
                .filter(month -> !month.isBefore(rangeStartMonth) && !month.isAfter(YearMonth.from(now)))
                .toList();
    YearMonth currentMonth =
        trendMonths.isEmpty() ? YearMonth.from(now) : trendMonths.get(trendMonths.size() - 1);
    ContractTotals summary =
        calculateContractTotals(
            contracts,
            dateRange == null ? currentMonth.atDay(1) : dateRange.periodStartDate(),
            now);

    Map<String, Object> trend = emptyContractTrend();
    for (int index = 0; index < trendMonths.size(); index += 1) {
      YearMonth month = trendMonths.get(index);
      LocalDate referenceDate = index == trendMonths.size() - 1 ? now : month.atEndOfMonth();
      ContractTotals totals = calculateContractTotals(contracts, month.atDay(1), referenceDate);

      list(trend, "dates").add(DashboardDateUtils.formatMonth(month));
      list(trend, "expiring").add(totals.expiring());
      list(trend, "newThisMonth").add(totals.newThisMonth());
      list(trend, "normal").add(totals.normal());
      list(trend, "retreated").add(totals.retreated());
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("summary", contractSummary(summary));
    result.put("trend", trend);
    return result;
  }

  /** 旧 analytics 合同总览：只统计成交租户，并使用 90 天作为即将到期阈值。 */
  public Map<String, Object> getAnalyticsContractOverview(String parkId) {
    AuthorizedDashboardContext context = authorizedContext(parkId);
    if (!context.hasAuthorizedParks() || !context.hasRequestedScope()) {
      return emptyAnalyticsContractOverview();
    }

    List<ContractDateRow> contracts =
        dashboardOverviewRepository.findAnalyticsContractDates(context.jdbcTemplate(), context.parkIds());
    LocalDate today = LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE);
    AnalyticsContractTotals summary = calculateAnalyticsContractTotals(contracts, today);
    Map<String, Object> trend = emptyAnalyticsContractTrend();
    List<YearMonth> months = trailingMonths(today, 12);
    for (YearMonth month : months) {
      AnalyticsContractTotals snapshot =
          calculateAnalyticsContractTotals(contracts, month.atEndOfMonth());
      list(trend, "dates").add(DashboardDateUtils.formatMonth(month));
      list(trend, "expiring").add(snapshot.expiring());
      list(trend, "normal").add(snapshot.normal());
      list(trend, "retreated").add(snapshot.retreated());
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("summary", analyticsContractSummary(summary));
    result.put("trend", trend);
    return result;
  }

  /**
   * 旧 `/analytics/revenue-overview` 营收总览。
   *
   * <p>旧接口会先执行租赁费用到财务表的同步；本方法只统计现有 finance 数据，避免 GET 产生写库副作用。
   */
  public Map<String, Object> getAnalyticsRevenueOverview(String parkId) {
    LocalDate today = LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE);
    List<YearMonth> months = trailingMonths(today, 12);
    AuthorizedDashboardContext context = authorizedContext(parkId);
    if (!context.hasAuthorizedParks() || !context.hasRequestedScope()) {
      return emptyAnalyticsRevenueOverview(today, months);
    }

    Instant start =
        months.get(0).atDay(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    Instant end = today.plusDays(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    List<FinanceRevenueRow> records =
        dashboardOverviewRepository.findFinanceRevenueRows(
            context.jdbcTemplate(), context.parkIds(), start, end);
    return analyticsRevenueOverviewFromRows(records, today, months);
  }

  /** 旧 `/dashboard/revenue-stats` 应收/实收营收统计，只读总账单当前数据。 */
  public Map<String, Object> getRevenueStats(RevenueStatsQuery query) {
    RevenuePeriod period = resolveRevenuePeriod(query);
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks() || !context.hasRequestedScope()) {
      return emptyRevenueStats(period);
    }

    List<String> projectMonthValues = projectMonthContainsValues(period.months());
    if (projectMonthValues.isEmpty()) {
      return emptyRevenueStats(period);
    }

    List<RevenueBillRow> bills =
        dashboardOverviewRepository.findRevenueBills(
            context.jdbcTemplate(), context.parkIds(), projectMonthValues);
    return revenueStatsFromBills(period, bills);
  }

  /** 统计招商客户意向等级、谈判进度和汇总数量。 */
  public Map<String, Object> getCustomerOverviewStats(DashboardOverviewQuery query) {
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks() || !context.hasRequestedScope()) {
      return emptyCustomerOverviewStats();
    }

    Instant periodStart;
    Instant periodEnd;
    if (StringUtils.hasText(query.startDate()) || StringUtils.hasText(query.endDate())) {
      DateRange dateRange = DashboardDateUtils.dateRange(query.startDate(), query.endDate());
      periodStart = dateRange.periodStartDate().atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
      periodEnd =
          dateRange.periodEndDate().plusDays(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    } else {
      LocalDate referenceDate = DashboardDateUtils.referenceDate(query.date());
      periodStart = Instant.EPOCH;
      periodEnd = referenceDate.plusDays(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    }

    List<InvestmentOverviewRow> investments =
        dashboardOverviewRepository.findInvestments(
            context.jdbcTemplate(), context.parkIds(), periodStart, periodEnd);
    Map<String, Integer> progressCounts = new LinkedHashMap<>();
    Map<String, Integer> intentLevelCounts = new LinkedHashMap<>();
    INTENT_LEVELS.forEach(level -> intentLevelCounts.put(level, 0));
    int signedCustomers = 0;

    for (InvestmentOverviewRow investment : investments) {
      String intentLevel = normalizeIntentLevel(investment.intentLevel());
      intentLevelCounts.put(intentLevel, intentLevelCounts.get(intentLevel) + 1);

      String progress = investment.progress() == null ? "" : investment.progress().trim();
      if (!progress.isBlank()) {
        progressCounts.put(progress, progressCounts.getOrDefault(progress, 0) + 1);
        if ("签约完成".equals(progress)) {
          signedCustomers += 1;
        }
      }
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put(
        "intentLevels",
        INTENT_LEVELS.stream().map(level -> namedValue(level, intentLevelCounts.get(level))).toList());
    result.put(
        "negotiationProgress",
        progressCounts.entrySet().stream()
            .map(entry -> namedValue(entry.getKey(), entry.getValue()))
            .toList());
    result.put(
        "summary",
        Map.of(
            "currentMonthNewCustomers",
            signedCustomers,
            "negotiatingCustomers",
            investments.size(),
            "receivedCustomers",
            investments.size(),
            "totalCustomers",
            investments.size()));
    return result;
  }

  /** 按账单创建时间倒推数据月份，统计电耗、环比和同比。 */
  public Map<String, Object> getElectricityConsumption(DashboardOverviewQuery query) {
    LocalDate referenceDate = energyReferenceDate(query);
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks()) {
      return emptyEnergyStats(referenceDate, "electricity", "当前用户没有可查看园区，暂无电耗数据");
    }
    if (!context.hasRequestedScope()) {
      return emptyEnergyStats(referenceDate, "electricity", "当前用户没有该园区权限，暂无电耗数据");
    }
    return energyStats(context, referenceDate, true);
  }

  /** 按账单创建时间倒推数据月份，统计水耗、环比和同比。 */
  public Map<String, Object> getWaterConsumption(DashboardOverviewQuery query) {
    LocalDate referenceDate = energyReferenceDate(query);
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks()) {
      return emptyEnergyStats(referenceDate, "water", "当前用户没有可查看园区，暂无水耗数据");
    }
    if (!context.hasRequestedScope()) {
      return emptyEnergyStats(referenceDate, "water", "当前用户没有该园区权限，暂无水耗数据");
    }
    return energyStats(context, referenceDate, false);
  }

  /**
   * 表计统计兼容接口。
   *
   * <p>旧 Nitro 最新版本会优先调用合众设备和历史数据接口，同时使用本地账单做月维度兜底；Spring Boot
   * 保持同样边界：只读第三方和本地账单，第三方网关异常时返回本地可用统计。
   */
  public Map<String, Object> getMeterStatistics(MeterStatisticsQuery query) {
    String statisticsType = "water".equalsIgnoreCase(query.type()) ? "water" : "electricity";
    String dateType = "day".equalsIgnoreCase(query.dateType()) ? "day" : "month";
    DateRangeContext range = meterDateRange(query, dateType);
    AuthorizedDashboardContext context = authorizedContext(query.parkId());
    if (!context.hasAuthorizedParks()) {
      return emptyMeterStatistics(
          statisticsType, dateType, range.selectedDate(), "当前用户没有可查看园区，暂无表计统计数据");
    }
    if (!context.hasRequestedScope()) {
      return emptyMeterStatistics(
          statisticsType, dateType, range.selectedDate(), "当前用户没有该园区权限，暂无表计统计数据");
    }

    List<EnergyBillRow> bills =
        dashboardOverviewRepository.findEnergyBills(
            context.jdbcTemplate(), context.parkIds(), range.createTimeStart(), range.createTimeEnd());
    Map<String, Object> localResult;
    if ("water".equals(statisticsType)) {
      localResult = waterMeterStatistics(bills, dateType, range);
    } else {
      localResult = electricityMeterStatistics(bills, dateType, range);
    }

    try {
      return hezhongMeterStatistics(query, statisticsType, dateType, range, context, localResult);
    } catch (BusinessException error) {
      if (!isRecoverableThirdPartyError(error)) {
        throw error;
      }
      return withMeterStatisticsMessage(
          localResult, THIRD_PARTY_UNAVAILABLE_MESSAGE, "amount_bill_local_fallback");
    }
  }

  private AuthorizedDashboardContext authorizedContext(String queryParkId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Map<String, Object>> authorizedParks =
        parkScopeService.resolveAuthorizedParks(jdbcTemplate, payload);
    List<Integer> authorizedParkIds =
        authorizedParks.stream()
            .map(park -> ((Number) park.get("parkId")).intValue())
            .distinct()
            .toList();
    List<Integer> requestedParkIds = resolveParkIds(queryParkId, authorizedParkIds);
    return new AuthorizedDashboardContext(
        jdbcTemplate,
        authorizedParkIds,
        requestedParkIds,
        requestedParks(authorizedParks, requestedParkIds));
  }

  private Map<String, Object> energyStats(
      AuthorizedDashboardContext context, LocalDate referenceDate, boolean electricity) {
    List<YearMonth> months = DashboardDateUtils.currentYearMonths(referenceDate);
    List<String> monthLabels = months.stream().map(DashboardDateUtils::formatMonth).toList();
    Set<String> monthLabelSet = Set.copyOf(monthLabels);
    YearMonth firstMonth = months.get(0);
    YearMonth lastMonth = months.get(months.size() - 1);
    Instant createTimeStart =
        firstMonth.minusMonths(11).atDay(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    Instant createTimeEnd =
        lastMonth.plusMonths(2).atDay(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    List<EnergyBillRow> bills =
        dashboardOverviewRepository.findEnergyBills(
            context.jdbcTemplate(), context.parkIds(), createTimeStart, createTimeEnd);

    Map<String, Double> monthTotals = new LinkedHashMap<>();
    int rangeBillCount = 0;
    for (EnergyBillRow bill : bills) {
      YearMonth dataMonth = dataMonth(bill.createTime());
      if (dataMonth == null) {
        continue;
      }
      double usage = electricity ? electricityUsage(bill) : waterUsage(bill);
      if (electricity && usage <= 0) {
        continue;
      }
      if (!electricity && usage == 0) {
        continue;
      }

      String monthLabel = dataMonth.toString();
      if (monthLabelSet.contains(monthLabel)) {
        rangeBillCount += 1;
      }
      monthTotals.put(monthLabel, monthTotals.getOrDefault(monthLabel, 0D) + usage);
    }

    List<Double> consumption =
        monthLabels.stream().map(month -> round2(monthTotals.getOrDefault(month, 0D))).toList();
    List<Double> monthOnMonth = new ArrayList<>();
    for (int index = 0; index < consumption.size(); index += 1) {
      double previous =
          index == 0
              ? monthTotals.getOrDefault(months.get(0).minusMonths(1).toString(), 0D)
              : consumption.get(index - 1);
      monthOnMonth.add(percentChange(consumption.get(index), previous));
    }
    List<Double> yearOnYear = new ArrayList<>();
    for (int index = 0; index < consumption.size(); index += 1) {
      double previous = monthTotals.getOrDefault(months.get(index).minusMonths(12).toString(), 0D);
      yearOnYear.add(percentChange(consumption.get(index), previous));
    }

    boolean hasData = rangeBillCount > 0;
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("hasData", hasData);
    if (!hasData) {
      result.put("message", electricity ? "当前年度未查询到账单电耗明细，暂无电耗数据" : "当前年度未查询到账单水耗明细，暂无水耗数据");
    }
    result.put("months", monthLabels);
    result.put(electricity ? "electricity" : "water", energySeries(consumption, monthOnMonth, yearOnYear));
    result.put("year", referenceDate.getYear());
    return result;
  }

  private Map<String, Object> hezhongMeterStatistics(
      MeterStatisticsQuery query,
      String statisticsType,
      String dateType,
      DateRangeContext range,
      AuthorizedDashboardContext context,
      Map<String, Object> localResult) {
    HezhongMeterType meterType =
        "water".equals(statisticsType) ? HezhongMeterType.WATER : HezhongMeterType.ELECTRICITY;
    String projCode =
        StringUtils.hasText(query.projCode())
            ? query.projCode().trim()
            : DEFAULT_METER_PROJ_CODE;
    List<MeterDeviceSnapshot> devices = fetchAllHezhongDevices(meterType, projCode);
    List<MeterDeviceSnapshot> permittedDevices =
        devices.stream().filter(device -> isDeviceInParks(device, context.parks())).toList();

    if (permittedDevices.isEmpty()
        && !("month".equals(dateType)
            && ("electricity".equals(statisticsType) || "water".equals(statisticsType)))) {
      String message =
          "water".equals(statisticsType)
              ? "当前权限范围内未匹配到水表设备，暂无表计统计数据"
              : "当前权限范围内未匹配到电表设备，暂无表计统计数据";
      return emptyMeterStatistics(statisticsType, dateType, range.selectedDate(), message);
    }

    Set<String> permittedAddresses = new LinkedHashSet<>();
    for (MeterDeviceSnapshot device : permittedDevices) {
      permittedAddresses.add(device.comAddress());
    }
    List<MeterReadingSnapshot> readings =
        fetchHezhongReadings(meterType, projCode, range, dateType, statisticsType, permittedAddresses);

    if ("water".equals(statisticsType)) {
      Map<String, Object> waterTrend =
          "month".equals(dateType)
              ? mapObject(localResult.get("waterTrend"))
              : hezhongWaterTrend(readings, range, dateType);
      int recordCount =
          "month".equals(dateType)
              ? numberValue(mapObject(localResult.get("summary")).get("recordCount")).intValue()
              : readings.size();
      double total =
          "month".equals(dateType)
              ? numberValue(mapObject(localResult.get("summary")).get("total")).doubleValue()
              : sumNumberList(waterTrend.get("values"));
      return meterStatisticsResult(
          "water",
          dateType,
          range.selectedDate(),
          List.of(namedValue("普通表", 0), namedValue("时段表", 0)),
          List.of(),
          waterTrend,
          permittedDevices.size(),
          recordCount,
          round2(total),
          recordCount > 0 ? null : "当前时间范围未查询到统计数据",
          "hezhong_vendor");
    }

    List<Map<String, Object>> peakValley =
        "month".equals(dateType)
            ? objectList(localResult.get("peakValley"))
            : hezhongPeakValley(readings);
    Map<String, Object> localSummary = mapObject(localResult.get("summary"));
    List<Map<String, Object>> dayNight =
        "month".equals(dateType) ? objectList(localResult.get("dayNight")) : hezhongDayNight(readings);
    int recordCount =
        "month".equals(dateType)
            ? numberValue(localSummary.get("recordCount")).intValue()
            : readings.size();
    double total =
        "month".equals(dateType)
            ? numberValue(localSummary.get("total")).doubleValue()
            : sumNamedValues(dayNight);
    return meterStatisticsResult(
        "electricity",
        dateType,
        range.selectedDate(),
        dayNight,
        peakValley,
        Map.of("times", List.of(), "values", List.of()),
        permittedDevices.size(),
        recordCount,
        round2(total),
        recordCount > 0 ? null : "当前时间范围未查询到统计数据",
        "hezhong_vendor");
  }

  private List<MeterDeviceSnapshot> fetchAllHezhongDevices(
      HezhongMeterType meterType, String projCode) {
    int pageSize = 1000;
    List<MeterDeviceSnapshot> devices = new ArrayList<>();
    for (int page = 1; page <= 50; page += 1) {
      Map<String, Object> response =
          hezhongClient.getDevice(
              Map.of(
                  "comtype",
                  meterType.comType(),
                  "page",
                  String.valueOf(page),
                  "pageSize",
                  String.valueOf(pageSize),
                  "projCode",
                  projCode));
      List<MeterDeviceSnapshot> pageDevices = normalizeHezhongDevices(response);
      devices.addAll(pageDevices);
      long total = hezhongTotal(response, devices.size());
      if (devices.size() >= total || pageDevices.isEmpty()) {
        break;
      }
    }
    return devices;
  }

  private List<MeterReadingSnapshot> fetchHezhongReadings(
      HezhongMeterType meterType,
      String projCode,
      DateRangeContext range,
      String dateType,
      String statisticsType,
      Set<String> permittedAddresses) {
    if (permittedAddresses.isEmpty()
        || ("water".equals(statisticsType) && "month".equals(dateType))) {
      return List.of();
    }

    int pageSize = 1000;
    List<MeterReadingSnapshot> readings = new ArrayList<>();
    for (int page = 1; page <= 100; page += 1) {
      Map<String, Object> response =
          hezhongClient.getHdmData(
              Map.of(
                  "comType",
                  meterType.comType(),
                  "page",
                  String.valueOf(page),
                  "pageSize",
                  String.valueOf(pageSize),
                  "projCode",
                  projCode,
                  "timeFrom",
                  range.timeFrom().format(METER_TIME_FORMATTER),
                  "timeTo",
                  range.timeTo().format(METER_TIME_FORMATTER),
                  "type",
                  "1"));
      List<MeterReadingSnapshot> rawPageReadings = normalizeHezhongReadings(response);
      List<MeterReadingSnapshot> pageReadings =
          rawPageReadings.stream()
              .filter(reading -> permittedAddresses.contains(reading.comAddress()))
              .filter(reading -> isInMeterDateRange(reading, range))
              .toList();
      readings.addAll(pageReadings);
      long total = hezhongTotal(response, page * (long) pageSize);
      if (page * (long) pageSize >= total || rawPageReadings.isEmpty()) {
        break;
      }
    }
    return readings;
  }

  private boolean isDeviceInParks(
      MeterDeviceSnapshot device, List<Map<String, Object>> parks) {
    String haystack =
        normalizeText(device.address() + " " + device.piplineName() + " " + device.comAddress());
    for (Map<String, Object> park : parks) {
      String parkName = normalizeText(String.valueOf(park.getOrDefault("parkName", "")));
      if (!parkName.isBlank() && haystack.contains(parkName)) {
        return true;
      }
    }
    return false;
  }

  private List<Map<String, Object>> hezhongPeakValley(List<MeterReadingSnapshot> readings) {
    double sharp = 0;
    double peak = 0;
    double flat = 0;
    double valley = 0;
    for (MeterReadingSnapshot reading : readings) {
      sharp += objectNumber(reading.dataValue1());
      peak += objectNumber(reading.dataValue2());
      flat += objectNumber(reading.dataValue3());
      valley += objectNumber(reading.dataValue4());
    }
    return List.of(
        namedValue("尖", round2(sharp)),
        namedValue("峰", round2(peak)),
        namedValue("平", round2(flat)),
        namedValue("谷", round2(valley)));
  }

  private List<Map<String, Object>> hezhongDayNight(List<MeterReadingSnapshot> readings) {
    double ordinary = 0;
    double timeOfUse = 0;
    for (MeterReadingSnapshot reading : readings) {
      if (isTimeOfUseReading(reading)) {
        timeOfUse += peakValleyReadingUsage(reading);
      } else {
        ordinary += objectNumber(reading.dataValue());
      }
    }
    return List.of(
        namedValue("普通表", round2(ordinary)),
        namedValue("时段表", round2(timeOfUse)));
  }

  private Map<String, Object> hezhongWaterTrend(
      List<MeterReadingSnapshot> readings, DateRangeContext range, String dateType) {
    if ("month".equals(dateType) && range.months().size() == 1) {
      YearMonth month = range.months().get(0);
      double[] totals = new double[month.lengthOfMonth()];
      for (MeterReadingSnapshot reading : readings) {
        if (reading.freezeTime() == null) {
          continue;
        }
        int index = reading.freezeTime().getDayOfMonth() - 1;
        if (index >= 0 && index < totals.length) {
          totals[index] += objectNumber(reading.dataValue());
        }
      }
      List<String> times =
          java.util.stream.IntStream.range(0, totals.length)
              .mapToObj(index -> (index + 1) + "日")
              .toList();
      List<Double> values =
          java.util.Arrays.stream(totals).map(this::round2).boxed().toList();
      return Map.of("times", times, "values", values);
    }

    double[] totals = new double[24];
    for (MeterReadingSnapshot reading : readings) {
      if (reading.freezeTime() == null) {
        continue;
      }
      int hour = reading.freezeTime().getHour();
      if (hour >= 0 && hour < totals.length) {
        totals[hour] += objectNumber(reading.dataValue());
      }
    }
    List<String> times =
        java.util.stream.IntStream.range(0, totals.length)
            .mapToObj(index -> index + "时")
            .toList();
    List<Double> values = java.util.Arrays.stream(totals).map(this::round2).boxed().toList();
    return Map.of("times", times, "values", values);
  }

  private List<MeterDeviceSnapshot> normalizeHezhongDevices(Map<String, Object> response) {
    List<MeterDeviceSnapshot> devices = new ArrayList<>();
    for (Map<String, Object> record : hezhongRecords(response)) {
      String comAddress = objectText(record.get("comAddress"));
      if (comAddress.isBlank()) {
        continue;
      }
      devices.add(
          new MeterDeviceSnapshot(
              objectText(record.get("address")),
              comAddress,
              objectText(record.get("piplineName"))));
    }
    return devices;
  }

  private List<MeterReadingSnapshot> normalizeHezhongReadings(Map<String, Object> response) {
    List<MeterReadingSnapshot> readings = new ArrayList<>();
    for (Map<String, Object> record : hezhongRecords(response)) {
      String comAddress = objectText(record.get("comAddress"));
      if (comAddress.isBlank()) {
        continue;
      }
      readings.add(
          new MeterReadingSnapshot(
              comAddress,
              record.get("dataValue"),
              record.get("dataValue1"),
              record.get("dataValue2"),
              record.get("dataValue3"),
              record.get("dataValue4"),
              parseMeterDate(record.get("freezeTime"))));
    }
    return readings;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> hezhongRecords(Map<String, Object> response) {
    Object list = null;
    Object data = response.get("data");
    if (data instanceof Map<?, ?> dataMap) {
      list = dataMap.get("records");
      if (list == null) {
        list = dataMap.get("items");
      }
    }
    if (list == null) {
      list = response.get("records");
    }
    if (list == null) {
      list = response.get("items");
    }
    if (list instanceof List<?> rawList) {
      return rawList.stream()
          .filter(Map.class::isInstance)
          .map(item -> (Map<String, Object>) item)
          .toList();
    }
    if (list instanceof Map<?, ?> map) {
      return List.of((Map<String, Object>) map);
    }
    return List.of();
  }

  private long hezhongTotal(Map<String, Object> response, long fallback) {
    Object data = response.get("data");
    Object rawTotal = null;
    if (data instanceof Map<?, ?> dataMap) {
      rawTotal = dataMap.get("total");
    }
    if (rawTotal == null) {
      rawTotal = response.get("total");
    }
    return numberValue(rawTotal, fallback).longValue();
  }

  private Map<String, Object> electricityMeterStatistics(
      List<EnergyBillRow> bills, String dateType, DateRangeContext range) {
    Map<String, Double> categories = new LinkedHashMap<>();
    categories.put("普通表", 0D);
    categories.put("时段表", 0D);
    Map<String, Double> peakValleyTotals = new LinkedHashMap<>();
    peakValleyTotals.put("尖", 0D);
    peakValleyTotals.put("峰", 0D);
    peakValleyTotals.put("平", 0D);
    peakValleyTotals.put("谷", 0D);
    int recordCount = 0;

    for (EnergyBillRow bill : bills) {
      YearMonth dataMonth = dataMonth(bill.createTime());
      if (dataMonth == null || !range.months().contains(dataMonth)) {
        continue;
      }
      List<JsonNode> jsonRows = parseJsonRows(bill.eleItem());
      if (!jsonRows.isEmpty()) {
        for (JsonNode row : jsonRows) {
          String meterName = cellValue(row.get("meterName"));
          if (isEmptyOrTotalMeterName(meterName)) {
            continue;
          }
          double usage = jsonRowUsage(row);
          String category = peakValleyName(meterName);
          if (category == null) {
            categories.put("普通表", categories.get("普通表") + usage);
          } else {
            categories.put("时段表", categories.get("时段表") + usage);
            peakValleyTotals.put(category, peakValleyTotals.get(category) + usage);
          }
          recordCount += 1;
        }
      } else {
        for (MeterBillRow row : bill.eleBills()) {
          if (isEmptyOrTotalMeterName(row.meterName())) {
            continue;
          }
          categories.put(
              "普通表",
              categories.get("普通表") + (row.totalUsage() == null ? 0 : row.totalUsage().doubleValue()));
          recordCount += 1;
        }
      }
    }

    List<Map<String, Object>> dayNight =
        categories.entrySet().stream()
            .map(entry -> namedValue(entry.getKey(), round2(entry.getValue())))
            .toList();
    List<Map<String, Object>> peakValley =
        peakValleyTotals.entrySet().stream()
            .map(entry -> namedValue(entry.getKey(), round2(entry.getValue())))
            .toList();
    return meterStatisticsResult(
        "electricity",
        dateType,
        range.selectedDate(),
        dayNight,
        peakValley,
        Map.of("times", List.of(), "values", List.of()),
        recordCount,
        round2(dayNight.stream().mapToDouble(item -> ((Number) item.get("value")).doubleValue()).sum()));
  }

  private Map<String, Object> waterMeterStatistics(
      List<EnergyBillRow> bills, String dateType, DateRangeContext range) {
    Map<String, Double> totalsByMonth = new LinkedHashMap<>();
    for (YearMonth month : range.months()) {
      totalsByMonth.put(month.toString(), 0D);
    }
    int recordCount = 0;
    for (EnergyBillRow bill : bills) {
      YearMonth dataMonth = dataMonth(bill.createTime());
      if (dataMonth == null || !range.months().contains(dataMonth)) {
        continue;
      }
      double usage = waterUsage(bill);
      if (usage == 0) {
        continue;
      }
      totalsByMonth.put(dataMonth.toString(), totalsByMonth.getOrDefault(dataMonth.toString(), 0D) + usage);
      recordCount += 1;
    }
    List<String> times = new ArrayList<>(totalsByMonth.keySet());
    List<Double> values = times.stream().map(month -> round2(totalsByMonth.getOrDefault(month, 0D))).toList();
    return meterStatisticsResult(
        "water",
        dateType,
        range.selectedDate(),
        List.of(namedValue("普通表", 0)),
        List.of(),
        Map.of("times", times, "values", values),
        recordCount,
        round2(values.stream().mapToDouble(Double::doubleValue).sum()));
  }

  private Map<String, Object> emptyMeterStatistics(
      String statisticsType, String dateType, String selectedDate, String message) {
    return meterStatisticsResult(
        statisticsType,
        dateType,
        selectedDate,
        List.of(namedValue("普通表", 0), namedValue("时段表", 0)),
        "electricity".equals(statisticsType)
            ? List.of(namedValue("尖", 0), namedValue("峰", 0), namedValue("平", 0), namedValue("谷", 0))
            : List.of(),
        Map.of("times", List.of(), "values", List.of()),
        0,
        0,
        message);
  }

  private Map<String, Object> meterStatisticsResult(
      String statisticsType,
      String dateType,
      String selectedDate,
      List<Map<String, Object>> dayNight,
      List<Map<String, Object>> peakValley,
      Map<String, Object> waterTrend,
      int recordCount,
      double total) {
    String message = recordCount > 0 ? null : "当前时间范围未查询到统计数据";
    return meterStatisticsResult(
        statisticsType,
        dateType,
        selectedDate,
        dayNight,
        peakValley,
        waterTrend,
        recordCount,
        total,
        message);
  }

  private Map<String, Object> meterStatisticsResult(
      String statisticsType,
      String dateType,
      String selectedDate,
      List<Map<String, Object>> dayNight,
      List<Map<String, Object>> peakValley,
      Map<String, Object> waterTrend,
      int recordCount,
      double total,
      String message) {
    return meterStatisticsResult(
        statisticsType,
        dateType,
        selectedDate,
        dayNight,
        peakValley,
        waterTrend,
        0,
        recordCount,
        total,
        message,
        "amount_bill_local");
  }

  private Map<String, Object> meterStatisticsResult(
      String statisticsType,
      String dateType,
      String selectedDate,
      List<Map<String, Object>> dayNight,
      List<Map<String, Object>> peakValley,
      Map<String, Object> waterTrend,
      int deviceCount,
      int recordCount,
      double total,
      String message,
      String source) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("dateType", dateType);
    result.put("dayNight", dayNight);
    result.put("hasData", recordCount > 0);
    result.put("message", message);
    result.put("peakValley", peakValley);
    result.put("selectedDate", selectedDate);
    result.put("statisticsType", statisticsType);
    result.put(
        "summary",
        Map.of("deviceCount", deviceCount, "recordCount", recordCount, "total", round2(total)));
    result.put("waterTrend", waterTrend);
    result.put("source", source);
    return result;
  }

  private DateRangeContext meterDateRange(MeterStatisticsQuery query, String dateType) {
    LocalDate start = DashboardDateUtils.parseDate(query.startDate());
    LocalDate end = DashboardDateUtils.parseDate(query.endDate());
    if (start != null && end != null) {
      LocalDate safeStart = start.isBefore(end) ? start : end;
      LocalDate safeEnd = start.isBefore(end) ? end : start;
      return dateRangeContext(
          dateType,
          safeStart,
          safeEnd,
          "day".equals(dateType)
              ? safeStart + "~" + safeEnd
              : YearMonth.from(safeStart) + "~" + YearMonth.from(safeEnd));
    }
    LocalDate reference = meterReferenceDate(query.date(), dateType);
    if ("day".equals(dateType)) {
      return dateRangeContext(dateType, reference, reference, reference.toString());
    }
    YearMonth month = YearMonth.from(reference);
    return dateRangeContext(dateType, month.atDay(1), month.atEndOfMonth(), month.toString());
  }

  private DateRangeContext dateRangeContext(
      String dateType, LocalDate start, LocalDate end, String selectedDate) {
    YearMonth startMonth = YearMonth.from(start);
    YearMonth endMonth = YearMonth.from(end);
    List<YearMonth> months = new ArrayList<>();
    YearMonth current = startMonth;
    while (!current.isAfter(endMonth)) {
      months.add(current);
      current = current.plusMonths(1);
    }
    Instant createTimeStart =
        startMonth.plusMonths(1).atDay(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    Instant createTimeEnd =
        endMonth.plusMonths(2).atDay(1).atStartOfDay(DashboardDateUtils.DASHBOARD_ZONE).toInstant();
    LocalDateTime timeFrom = LocalDateTime.of(start, LocalTime.MIN);
    LocalDateTime timeTo = LocalDateTime.of(end, LocalTime.MAX);
    return new DateRangeContext(
        createTimeEnd, createTimeStart, dateType, List.copyOf(months), selectedDate, timeFrom, timeTo);
  }

  private LocalDate meterReferenceDate(String value, String dateType) {
    LocalDate parsed = DashboardDateUtils.parseDate(value);
    if (parsed != null) {
      return parsed;
    }
    if ("month".equals(dateType) && StringUtils.hasText(value)) {
      try {
        return YearMonth.parse(value.trim()).atDay(1);
      } catch (RuntimeException ignored) {
        return LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE);
      }
    }
    return LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE);
  }

  private String peakValleyName(String meterName) {
    String normalized = normalizeText(meterName);
    if (normalized.startsWith("尖")) {
      return "尖";
    }
    if (normalized.startsWith("峰")) {
      return "峰";
    }
    if (normalized.startsWith("平")) {
      return "平";
    }
    if (normalized.startsWith("谷")) {
      return "谷";
    }
    return null;
  }

  private Map<String, Object> withMeterStatisticsMessage(
      Map<String, Object> result, String message, String source) {
    Map<String, Object> copy = new LinkedHashMap<>(result);
    copy.put("message", message);
    copy.put("source", source);
    return copy;
  }

  private boolean isRecoverableThirdPartyError(BusinessException error) {
    return error.getStatus() == HttpStatus.BAD_GATEWAY;
  }

  private boolean isTimeOfUseReading(MeterReadingSnapshot reading) {
    return objectNumber(reading.dataValue1()) != 0
        || objectNumber(reading.dataValue2()) != 0
        || objectNumber(reading.dataValue3()) != 0
        || objectNumber(reading.dataValue4()) != 0;
  }

  private double peakValleyReadingUsage(MeterReadingSnapshot reading) {
    double peakValleyTotal =
        objectNumber(reading.dataValue1())
            + objectNumber(reading.dataValue2())
            + objectNumber(reading.dataValue3())
            + objectNumber(reading.dataValue4());
    double total = objectNumber(reading.dataValue());
    return total == 0 ? peakValleyTotal : total;
  }

  private boolean isInMeterDateRange(MeterReadingSnapshot reading, DateRangeContext range) {
    if (reading.freezeTime() == null) {
      return false;
    }
    return !reading.freezeTime().isBefore(range.timeFrom())
        && !reading.freezeTime().isAfter(range.timeTo());
  }

  private double sumNamedValues(List<Map<String, Object>> items) {
    double total = 0;
    for (Map<String, Object> item : items) {
      total += numberValue(item.get("value")).doubleValue();
    }
    return total;
  }

  private double sumNumberList(Object value) {
    if (!(value instanceof List<?> list)) {
      return 0;
    }
    double total = 0;
    for (Object item : list) {
      total += numberValue(item).doubleValue();
    }
    return total;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> objectList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream()
        .filter(Map.class::isInstance)
        .map(item -> (Map<String, Object>) item)
        .toList();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> mapObject(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
  }

  private LocalDateTime parseMeterDate(Object value) {
    String text = objectText(value);
    if (text.isBlank()) {
      return null;
    }
    try {
      return LocalDateTime.parse(text, METER_TIME_FORMATTER);
    } catch (RuntimeException error) {
      try {
        return LocalDateTime.parse(text.replace(" ", "T"));
      } catch (RuntimeException ignored) {
        return null;
      }
    }
  }

  private Number numberValue(Object value) {
    return numberValue(value, 0);
  }

  private Number numberValue(Object value, double fallback) {
    if (value instanceof Number number) {
      return number;
    }
    try {
      String normalized = objectText(value).replace(",", "");
      return normalized.isBlank() ? fallback : Double.parseDouble(normalized);
    } catch (NumberFormatException error) {
      return fallback;
    }
  }

  private double objectNumber(Object value) {
    return numberValue(value).doubleValue();
  }

  private String objectText(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private LocalDate energyReferenceDate(DashboardOverviewQuery query) {
    LocalDate fallback = LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE);
    if (query.year() != null && query.year() > 0) {
      fallback = LocalDate.of(query.year(), fallback.getMonthValue(), 1);
    }
    return DashboardDateUtils.referenceDate(firstText(query.endDate(), query.date()), fallback);
  }

  private double electricityUsage(EnergyBillRow bill) {
    double amountBillUsage = sumElectricityJsonUsage(parseJsonRows(bill.eleItem()));
    double fallbackUsage = bill.eleBills().isEmpty() ? 0 : sumMeterBillUsage(bill.eleBills());
    return amountBillUsage != 0 ? amountBillUsage : fallbackUsage;
  }

  private double waterUsage(EnergyBillRow bill) {
    List<JsonNode> waterItems = parseJsonRows(bill.waterItem());
    return waterItems.isEmpty() ? sumMeterBillUsage(bill.waterBills()) : sumWaterJsonUsage(waterItems);
  }

  private List<JsonNode> parseJsonRows(String value) {
    if (!StringUtils.hasText(value)) {
      return List.of();
    }
    try {
      JsonNode parsed = objectMapper.readTree(value);
      if (!parsed.isArray()) {
        return List.of();
      }
      List<JsonNode> rows = new ArrayList<>();
      parsed.forEach(
          item -> {
            if (item != null && item.isObject()) {
              rows.add(item);
            }
          });
      return rows;
    } catch (Exception error) {
      return List.of();
    }
  }

  private double sumElectricityJsonUsage(List<JsonNode> items) {
    double total = 0;
    for (JsonNode item : items) {
      if (isEmptyOrTotalMeterName(cellValue(item.get("meterName")))) {
        continue;
      }
      total += jsonRowUsage(item);
    }
    return total;
  }

  private double sumWaterJsonUsage(List<JsonNode> items) {
    List<JsonNode> totalRows =
        items.stream()
            .filter(item -> isTotalMeterName(cellValue(item.get("meterName"))))
            .toList();
    List<JsonNode> rows = totalRows.isEmpty() ? items : totalRows;
    return rows.stream()
        .filter(item -> !totalRows.isEmpty() || !isTotalMeterName(cellValue(item.get("meterName"))))
        .mapToDouble(this::jsonRowUsage)
        .sum();
  }

  private double jsonRowUsage(JsonNode item) {
    double totalUsage = toNumber(cellValue(item.get("totalUsage")));
    return totalUsage != 0 ? totalUsage : toNumber(cellValue(item.get("monthlyUsage")));
  }

  private String cellValue(JsonNode value) {
    if (value == null || value.isMissingNode() || value.isNull()) {
      return "";
    }
    if (value.isObject()) {
      JsonNode cellValue = value.get("value");
      if (cellValue != null && !cellValue.isMissingNode()) {
        return scalarText(cellValue);
      }
      return scalarText(value.get("originalText"));
    }
    return scalarText(value);
  }

  private String scalarText(JsonNode value) {
    if (value == null || value.isMissingNode() || value.isNull()) {
      return "";
    }
    return value.isTextual() ? value.asText() : value.toString();
  }

  private boolean isEmptyOrTotalMeterName(String meterName) {
    String normalized = normalizeText(meterName);
    return normalized.isBlank() || normalized.contains("合计");
  }

  private boolean isTotalMeterName(String meterName) {
    return normalizeText(meterName).contains("合计");
  }

  private String normalizeText(String value) {
    return String.valueOf(value == null ? "" : value).replaceAll("\\s+", "").toLowerCase();
  }

  private double sumMeterBillUsage(List<MeterBillRow> items) {
    List<MeterBillRow> totalRows =
        items.stream().filter(item -> isTotalMeterName(item.meterName())).toList();
    List<MeterBillRow> rows = totalRows.isEmpty() ? items : totalRows;
    return rows.stream()
        .filter(item -> !totalRows.isEmpty() || !isTotalMeterName(item.meterName()))
        .mapToDouble(item -> item.totalUsage() == null ? 0 : item.totalUsage().doubleValue())
        .sum();
  }

  private YearMonth dataMonth(Instant createTime) {
    if (createTime == null) {
      return null;
    }
    return YearMonth.from(createTime.atZone(DashboardDateUtils.DASHBOARD_ZONE).toLocalDate()).minusMonths(1);
  }

  private List<Integer> resolveParkIds(String queryParkId, List<Integer> authorizedParkIds) {
    if (queryParkId == null || "all".equals(queryParkId) || "-1".equals(queryParkId)) {
      return authorizedParkIds;
    }
    try {
      int parkId = Integer.parseInt(queryParkId.trim());
      return authorizedParkIds.contains(parkId) ? List.of(parkId) : null;
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private List<Map<String, Object>> requestedParks(
      List<Map<String, Object>> authorizedParks, List<Integer> requestedParkIds) {
    if (requestedParkIds == null || requestedParkIds.isEmpty()) {
      return List.of();
    }
    Set<Integer> requestedIdSet = Set.copyOf(requestedParkIds);
    return authorizedParks.stream()
        .filter(
            park ->
                park.get("parkId") instanceof Number number
                    && requestedIdSet.contains(number.intValue()))
        .toList();
  }

  private ContractTotals calculateContractTotals(
      List<ContractDateRow> contracts, LocalDate newContractPeriodStart, LocalDate referenceDate) {
    int expiring = 0;
    int newThisMonth = 0;
    int normal = 0;
    int retreated = 0;
    for (ContractDateRow contract : contracts) {
      LocalDate contractStart = localDate(contract.contractStart());
      LocalDate contractEnd = localDate(contract.contractEnd());
      if (isNewContractInPeriod(newContractPeriodStart, referenceDate, contractStart)) {
        newThisMonth += 1;
      }
      if (isActiveContract(referenceDate, contractStart, contractEnd)) {
        normal += 1;
        if (isExpiringContractInOneMonth(referenceDate, contractStart, contractEnd)) {
          expiring += 1;
        }
      } else if (isRetreatedContract(referenceDate, contractEnd)) {
        retreated += 1;
      }
    }
    return new ContractTotals(expiring, newThisMonth, normal, retreated);
  }

  private boolean isActiveContract(LocalDate referenceDate, LocalDate contractStart, LocalDate contractEnd) {
    if (contractEnd != null && contractEnd.isBefore(referenceDate)) {
      return false;
    }
    return contractStart == null || !contractStart.isAfter(referenceDate);
  }

  private boolean isRetreatedContract(LocalDate referenceDate, LocalDate contractEnd) {
    return contractEnd != null && contractEnd.isBefore(referenceDate);
  }

  private boolean isNewContractInPeriod(
      LocalDate periodStart, LocalDate periodEndDate, LocalDate contractStart) {
    return contractStart != null
        && !contractStart.isBefore(periodStart)
        && !contractStart.isAfter(periodEndDate);
  }

  private boolean isExpiringContractInOneMonth(
      LocalDate referenceDate, LocalDate contractStart, LocalDate contractEnd) {
    return contractEnd != null
        && isActiveContract(referenceDate, contractStart, contractEnd)
        && !contractEnd.isAfter(referenceDate.plusMonths(1));
  }

  private AnalyticsContractTotals calculateAnalyticsContractTotals(
      List<ContractDateRow> contracts, LocalDate referenceDate) {
    int expiring = 0;
    int normal = 0;
    int retreated = 0;
    for (ContractDateRow contract : contracts) {
      LocalDate contractStart = localDate(contract.contractStart());
      LocalDate contractEnd = localDate(contract.contractEnd());
      if (isRetreatedContract(referenceDate, contractEnd)) {
        retreated += 1;
        continue;
      }
      if (!isActiveContract(referenceDate, contractStart, contractEnd)) {
        continue;
      }
      if (isAnalyticsExpiringContract(referenceDate, contractEnd)) {
        expiring += 1;
      } else {
        normal += 1;
      }
    }
    return new AnalyticsContractTotals(expiring, normal, retreated);
  }

  private boolean isAnalyticsExpiringContract(LocalDate referenceDate, LocalDate contractEnd) {
    return contractEnd != null && !contractEnd.isAfter(referenceDate.plusDays(90));
  }

  private LocalDate localDate(Instant value) {
    return value == null ? null : value.atZone(DashboardDateUtils.DASHBOARD_ZONE).toLocalDate();
  }

  private Map<String, Object> emptyFactoryRentalStats() {
    Map<String, Object> stats = new LinkedHashMap<>();
    stats.put("invalidTotalAreaCount", 0);
    stats.put("overusedCount", 0);
    stats.put("partialCount", 0);
    stats.put("rentalRate", "0.00");
    stats.put("rentedArea", "0.00");
    stats.put("rentedCount", 0);
    stats.put("totalArea", "0.00");
    stats.put("totalCount", 0);
    stats.put("vacantArea", "0.00");
    stats.put("vacantCount", 0);
    return stats;
  }

  private Map<String, Object> emptyContractStats() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("summary", contractSummary(new ContractTotals(0, 0, 0, 0)));
    result.put("trend", emptyContractTrend());
    return result;
  }

  private Map<String, Object> emptyAnalyticsContractOverview() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("summary", analyticsContractSummary(new AnalyticsContractTotals(0, 0, 0)));
    result.put(
        "trend",
        analyticsContractTrend(
            List.of(), trailingMonths(LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE), 12)));
    return result;
  }

  private Map<String, Object> emptyAnalyticsRevenueOverview(
      LocalDate referenceDate, List<YearMonth> months) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put(
        "summary",
        Map.of(
            "expenseTotal",
            0,
            "incomeTotal",
            0,
            "netTotal",
            0,
            "yearLabel",
            referenceDate.getYear() + "年度"));
    result.put("trend", emptyAnalyticsRevenueTrend(months));
    return result;
  }

  private Map<String, Object> emptyContractTrend() {
    Map<String, Object> trend = new LinkedHashMap<>();
    trend.put("dates", new ArrayList<>());
    trend.put("expiring", new ArrayList<>());
    trend.put("newThisMonth", new ArrayList<>());
    trend.put("normal", new ArrayList<>());
    trend.put("retreated", new ArrayList<>());
    return trend;
  }

  private Map<String, Object> emptyAnalyticsRevenueTrend(List<YearMonth> months) {
    Map<String, Object> trend = new LinkedHashMap<>();
    trend.put("expense", zeroMoneySeries(months.size()));
    trend.put("income", zeroMoneySeries(months.size()));
    trend.put("months", months.stream().map(DashboardDateUtils::formatMonth).toList());
    trend.put("net", zeroMoneySeries(months.size()));
    return trend;
  }

  private Map<String, Object> emptyAnalyticsContractTrend() {
    Map<String, Object> trend = new LinkedHashMap<>();
    trend.put("dates", new ArrayList<>());
    trend.put("expiring", new ArrayList<>());
    trend.put("normal", new ArrayList<>());
    trend.put("retreated", new ArrayList<>());
    return trend;
  }

  private Map<String, Object> contractSummary(ContractTotals totals) {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("expiring", totals.expiring());
    summary.put("newThisMonth", totals.newThisMonth());
    summary.put("normal", totals.normal());
    summary.put("retreated", totals.retreated());
    return summary;
  }

  private Map<String, Object> analyticsContractSummary(AnalyticsContractTotals totals) {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("expiring", totals.expiring());
    summary.put("normal", totals.normal());
    summary.put("retreated", totals.retreated());
    return summary;
  }

  private Map<String, Object> emptyCustomerOverviewStats() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("intentLevels", INTENT_LEVELS.stream().map(level -> namedValue(level, 0)).toList());
    result.put("negotiationProgress", List.of());
    result.put(
        "summary",
        Map.of(
            "currentMonthNewCustomers",
            0,
            "negotiatingCustomers",
            0,
            "receivedCustomers",
            0,
            "totalCustomers",
            0));
    return result;
  }

  private Map<String, Object> emptyEnergyStats(LocalDate referenceDate, String key, String message) {
    List<String> months =
        DashboardDateUtils.currentYearMonths(referenceDate).stream()
            .map(DashboardDateUtils::formatMonth)
            .toList();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("hasData", false);
    result.put("message", message);
    result.put("months", months);
    result.put(
        key,
        energySeries(
            zeroSeries(months.size()),
            zeroSeries(months.size()),
            zeroSeries(months.size())));
    result.put("year", referenceDate.getYear());
    return result;
  }

  private Map<String, Object> emptyRevenueStats(RevenuePeriod period) {
    List<String> months = period.months().stream().map(DashboardDateUtils::formatMonth).toList();
    List<Double> emptySeries = zeroMoneySeries(months.size());
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("billCount", 0);
    summary.put("expenseTotal", 0);
    summary.put("incomeTotal", 0);
    summary.put("overpaidTotal", 0);
    summary.put("profit", 0);
    summary.put("receivableTotal", 0);
    summary.put("receivedTotal", 0);
    summary.put("remainingTotal", 0);

    Map<String, Object> trend = new LinkedHashMap<>();
    trend.put("expense", emptySeries);
    trend.put("income", emptySeries);
    trend.put("months", months);
    trend.put("overpaid", emptySeries);
    trend.put("profit", emptySeries);
    trend.put("receivable", emptySeries);
    trend.put("received", emptySeries);
    trend.put("remaining", emptySeries);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("periodLabel", period.label());
    result.put("summary", summary);
    result.put("trend", trend);
    return result;
  }

  private Map<String, Object> energySeries(
      List<Double> consumption, List<Double> monthOnMonth, List<Double> yearOnYear) {
    Map<String, Object> series = new LinkedHashMap<>();
    series.put("consumption", consumption);
    series.put("monthOnMonth", monthOnMonth);
    series.put("yearOnYear", yearOnYear);
    return series;
  }

  private List<Double> zeroSeries(int size) {
    return java.util.stream.IntStream.range(0, size).mapToObj(ignored -> 0D).toList();
  }

  private List<Double> zeroMoneySeries(int size) {
    return java.util.stream.IntStream.range(0, size).mapToObj(ignored -> 0.0D).toList();
  }

  private Map<String, Object> analyticsRevenueOverviewFromRows(
      List<FinanceRevenueRow> records, LocalDate referenceDate, List<YearMonth> months) {
    List<String> monthLabels = months.stream().map(DashboardDateUtils::formatMonth).toList();
    Map<String, Integer> monthIndex = new LinkedHashMap<>();
    for (int index = 0; index < monthLabels.size(); index += 1) {
      monthIndex.put(monthLabels.get(index), index);
    }
    long[] incomeCents = new long[monthLabels.size()];
    long[] expenseCents = new long[monthLabels.size()];
    long incomeTotalCents = 0;
    long expenseTotalCents = 0;
    for (FinanceRevenueRow record : records) {
      if (record.transactionTime() == null) {
        continue;
      }
      YearMonth month =
          YearMonth.from(record.transactionTime().atZone(DashboardDateUtils.DASHBOARD_ZONE));
      Integer index = monthIndex.get(DashboardDateUtils.formatMonth(month));
      long amount = cents(record.amount());
      boolean currentYear = month.getYear() == referenceDate.getYear();
      if ("收入".equals(record.transactionType())) {
        if (index != null) {
          incomeCents[index] += amount;
        }
        if (currentYear) {
          incomeTotalCents += amount;
        }
      } else if ("支出".equals(record.transactionType())) {
        if (index != null) {
          expenseCents[index] += amount;
        }
        if (currentYear) {
          expenseTotalCents += amount;
        }
      }
    }

    Map<String, Object> trend = new LinkedHashMap<>();
    trend.put("expense", toMoneyList(expenseCents));
    trend.put("income", toMoneyList(incomeCents));
    trend.put("months", monthLabels);
    trend.put("net", subtractMoneyList(incomeCents, expenseCents));

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("expenseTotal", money(expenseTotalCents));
    summary.put("incomeTotal", money(incomeTotalCents));
    summary.put("netTotal", money(incomeTotalCents - expenseTotalCents));
    summary.put("yearLabel", referenceDate.getYear() + "年度");

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("summary", summary);
    result.put("trend", trend);
    return result;
  }

  private Map<String, Object> revenueStatsFromBills(RevenuePeriod period, List<RevenueBillRow> bills) {
    List<YearMonth> months = period.months();
    List<String> monthLabels = months.stream().map(DashboardDateUtils::formatMonth).toList();
    Map<Integer, Integer> monthIndexBySortKey = new LinkedHashMap<>();
    for (int index = 0; index < months.size(); index += 1) {
      monthIndexBySortKey.put(monthSortKey(months.get(index)), index);
    }
    long[] receivableCents = new long[months.size()];
    long[] receivedCents = new long[months.size()];
    long[] remainingCents = new long[months.size()];
    long[] overpaidCents = new long[months.size()];
    int billCount = 0;

    for (RevenueBillRow bill : bills) {
      Integer projectMonthKey = singleProjectMonthSortKey(bill.projectName());
      Integer monthIndex = projectMonthKey == null ? null : monthIndexBySortKey.get(projectMonthKey);
      if (monthIndex == null) {
        continue;
      }
      long totalFee = cents(bill.totalFee());
      long received = cents(bill.receiptAmount());
      receivableCents[monthIndex] += totalFee;
      receivedCents[monthIndex] += received;
      remainingCents[monthIndex] += Math.max(totalFee - received, 0);
      overpaidCents[monthIndex] += Math.max(received - totalFee, 0);
      billCount += 1;
    }

    long receivableTotal = sum(receivableCents);
    long receivedTotal = sum(receivedCents);
    long remainingTotal = sum(remainingCents);
    long overpaidTotal = sum(overpaidCents);

    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("billCount", billCount);
    summary.put("expenseTotal", money(receivableTotal));
    summary.put("incomeTotal", money(receivedTotal));
    summary.put("overpaidTotal", money(overpaidTotal));
    summary.put("profit", money(receivedTotal - receivableTotal));
    summary.put("receivableTotal", money(receivableTotal));
    summary.put("receivedTotal", money(receivedTotal));
    summary.put("remainingTotal", money(remainingTotal));

    Map<String, Object> trend = new LinkedHashMap<>();
    trend.put("expense", toMoneyList(receivableCents));
    trend.put("income", toMoneyList(receivedCents));
    trend.put("months", monthLabels);
    trend.put("overpaid", toMoneyList(overpaidCents));
    trend.put("profit", subtractMoneyList(receivedCents, receivableCents));
    trend.put("receivable", toMoneyList(receivableCents));
    trend.put("received", toMoneyList(receivedCents));
    trend.put("remaining", toMoneyList(remainingCents));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("periodLabel", period.label());
    result.put("summary", summary);
    result.put("trend", trend);
    return result;
  }

  private RevenuePeriod resolveRevenuePeriod(RevenueStatsQuery query) {
    LocalDate start = DashboardDateUtils.parseDate(query.startDate());
    LocalDate end = DashboardDateUtils.parseDate(query.endDate());
    if (start != null && end != null) {
      LocalDate periodStart = start.isBefore(end) ? start : end;
      LocalDate periodEnd = start.isBefore(end) ? end : start;
      return new RevenuePeriod(
          monthsBetween(periodStart, periodEnd),
          formatDateLabel(periodStart) + "-" + formatDateLabel(periodEnd));
    }

    LocalDate selectedDate = DashboardDateUtils.parseDate(query.date());
    if (selectedDate != null) {
      YearMonth month = YearMonth.from(selectedDate);
      return new RevenuePeriod(
          List.of(month),
          month.getYear() + "年" + month.getMonthValue() + "月1日-" + formatDateLabel(selectedDate));
    }

    YearMonth selectedMonth = parseYearMonth(query.month());
    if (selectedMonth != null) {
      return new RevenuePeriod(
          List.of(selectedMonth),
          selectedMonth.getYear() + "年" + selectedMonth.getMonthValue() + "月");
    }

    LocalDate now = LocalDate.now(DashboardDateUtils.DASHBOARD_ZONE);
    List<YearMonth> months = DashboardDateUtils.currentYearMonths(now);
    return new RevenuePeriod(months, now.getYear() + "年1-" + now.getMonthValue() + "月");
  }

  private List<YearMonth> monthsBetween(LocalDate start, LocalDate end) {
    List<YearMonth> months = new ArrayList<>();
    YearMonth current = YearMonth.from(start);
    YearMonth last = YearMonth.from(end);
    while (!current.isAfter(last)) {
      months.add(current);
      current = current.plusMonths(1);
    }
    return months;
  }

  private List<String> projectMonthContainsValues(List<YearMonth> months) {
    List<String> values = new ArrayList<>();
    for (YearMonth month : months) {
      int year = month.getYear();
      int monthNumber = month.getMonthValue();
      String paddedMonth = String.format("%02d", monthNumber);
      values.add(year + "年" + monthNumber + "月");
      values.add(year + "年" + paddedMonth + "月");
      values.add(year + "-" + paddedMonth);
      values.add(year + "." + paddedMonth);
      values.add(year + "/" + paddedMonth);
      values.add(year + paddedMonth);
    }
    return values.stream().distinct().toList();
  }

  private Integer singleProjectMonthSortKey(String value) {
    List<ProjectMonthReference> references = projectMonthReferences(value);
    if (references.isEmpty()) {
      return null;
    }
    List<Integer> utilityKeys = keywordProjectMonthSortKeys(value, Pattern.compile("水费|电费|水[、,，]?电|用水|用电"));
    if (utilityKeys.size() == 1) {
      return utilityKeys.get(0);
    }
    List<Integer> rentKeys = keywordProjectMonthSortKeys(value, Pattern.compile("房租|租金|租赁费"));
    if (rentKeys.size() == 1) {
      return rentKeys.get(0);
    }
    return references.size() == 1 ? references.get(0).key() : null;
  }

  private List<Integer> keywordProjectMonthSortKeys(String value, Pattern keywordPattern) {
    String compactText = compactText(value);
    List<ProjectMonthReference> references = projectMonthReferences(value);
    if (compactText.isBlank() || references.isEmpty()) {
      return List.of();
    }
    List<Integer> keys = new ArrayList<>();
    for (int index = 0; index < references.size(); index += 1) {
      ProjectMonthReference current = references.get(index);
      int nextStart =
          index + 1 < references.size()
              ? references.get(index + 1).start()
              : compactText.length();
      String segmentAfterMonth = compactText.substring(current.end(), nextStart);
      if (keywordPattern.matcher(segmentAfterMonth).find()) {
        keys.add(current.key());
      }
    }
    if (keys.isEmpty()) {
      for (String segment : compactText.split("[、,，;；]")) {
        if (!keywordPattern.matcher(segment).find()) {
          continue;
        }
        List<ProjectMonthReference> segmentReferences = projectMonthReferences(segment);
        if (segmentReferences.size() == 1) {
          keys.add(segmentReferences.get(0).key());
        }
      }
    }
    return keys.stream().distinct().toList();
  }

  private List<ProjectMonthReference> projectMonthReferences(String value) {
    String compactText = compactText(value);
    if (compactText.isBlank()) {
      return List.of();
    }
    List<ProjectMonthReference> references = new ArrayList<>();
    Matcher separatedMatcher =
        Pattern.compile("((?:19|20)\\d{2})[年/.-](0?[1-9]|1[0-2])月?份?").matcher(compactText);
    while (separatedMatcher.find()) {
      Integer key =
          toMonthSortKey(
              Integer.parseInt(separatedMatcher.group(1)),
              Integer.parseInt(separatedMatcher.group(2)));
      if (key != null) {
        references.add(new ProjectMonthReference(separatedMatcher.start(), separatedMatcher.end(), key));
      }
    }
    Matcher compactMatcher = Pattern.compile("((?:19|20)\\d{2})(0[1-9]|1[0-2])").matcher(compactText);
    while (compactMatcher.find()) {
      Integer key =
          toMonthSortKey(
              Integer.parseInt(compactMatcher.group(1)),
              Integer.parseInt(compactMatcher.group(2)));
      if (key == null) {
        continue;
      }
      int start = compactMatcher.start();
      int end = compactMatcher.end();
      boolean overlaps =
          references.stream().anyMatch(reference -> start < reference.end() && end > reference.start());
      if (!overlaps) {
        references.add(new ProjectMonthReference(start, end, key));
      }
    }
    references.sort(java.util.Comparator.comparing(ProjectMonthReference::start));
    return references;
  }

  private YearMonth parseYearMonth(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      return YearMonth.parse(value.trim());
    } catch (RuntimeException error) {
      return null;
    }
  }

  private Integer toMonthSortKey(int year, int month) {
    if (year < 1900 || year > 2100 || month < 1 || month > 12) {
      return null;
    }
    return year * 12 + month;
  }

  private int monthSortKey(YearMonth month) {
    return month.getYear() * 12 + month.getMonthValue();
  }

  private String compactText(String value) {
    return value == null ? "" : value.replaceAll("\\s+", "");
  }

  private String formatDateLabel(LocalDate date) {
    return date.getYear() + "年" + date.getMonthValue() + "月" + date.getDayOfMonth() + "日";
  }

  private long cents(BigDecimal value) {
    if (value == null) {
      return 0;
    }
    return value.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValue();
  }

  private long sum(long[] values) {
    long total = 0;
    for (long value : values) {
      total += value;
    }
    return total;
  }

  private double money(long cents) {
    return BigDecimal.valueOf(cents).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP).doubleValue();
  }

  private List<Double> toMoneyList(long[] cents) {
    return java.util.Arrays.stream(cents).mapToDouble(this::money).boxed().toList();
  }

  private List<Double> subtractMoneyList(long[] left, long[] right) {
    List<Double> result = new ArrayList<>();
    for (int index = 0; index < left.length; index += 1) {
      result.add(money(left[index] - right[index]));
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private List<Object> list(Map<String, Object> map, String key) {
    return (List<Object>) map.get(key);
  }

  private Map<String, Object> namedValue(String name, Object value) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("name", name);
    item.put("value", value);
    return item;
  }

  private String normalizeIntentLevel(String intentLevel) {
    return INTENT_LEVELS.contains(intentLevel) ? intentLevel : "一般";
  }

  private BigDecimal positive(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value.max(BigDecimal.ZERO);
  }

  private String fixed2(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
  }

  private double round2(double value) {
    return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
  }

  private double percentChange(double current, double previous) {
    if (previous == 0) {
      return 0;
    }
    return round2(((current - previous) / previous) * 100);
  }

  private double toNumber(String value) {
    if (value == null) {
      return 0;
    }
    try {
      String normalized = value.replace(",", "").trim();
      return normalized.isEmpty() ? 0 : Double.parseDouble(normalized);
    } catch (NumberFormatException error) {
      return 0;
    }
  }

  private String firstText(String first, String second) {
    return StringUtils.hasText(first) ? first : second;
  }

  private List<YearMonth> trailingMonths(LocalDate referenceDate, int count) {
    List<YearMonth> months = new ArrayList<>();
    YearMonth start = YearMonth.from(referenceDate).minusMonths(count - 1L);
    for (int index = 0; index < count; index += 1) {
      months.add(start.plusMonths(index));
    }
    return months;
  }

  private Map<String, Object> analyticsContractTrend(
      List<ContractDateRow> contracts, List<YearMonth> months) {
    Map<String, Object> trend = emptyAnalyticsContractTrend();
    for (YearMonth month : months) {
      AnalyticsContractTotals snapshot =
          calculateAnalyticsContractTotals(contracts, month.atEndOfMonth());
      list(trend, "dates").add(DashboardDateUtils.formatMonth(month));
      list(trend, "expiring").add(snapshot.expiring());
      list(trend, "normal").add(snapshot.normal());
      list(trend, "retreated").add(snapshot.retreated());
    }
    return trend;
  }

  private record AuthorizedDashboardContext(
      JdbcTemplate jdbcTemplate,
      List<Integer> authorizedParkIds,
      List<Integer> parkIds,
      List<Map<String, Object>> parks) {
    boolean hasAuthorizedParks() {
      return !authorizedParkIds.isEmpty();
    }

    boolean hasRequestedScope() {
      return parkIds != null && !parkIds.isEmpty();
    }
  }

  private record ContractTotals(int expiring, int newThisMonth, int normal, int retreated) {}

  private record DateRangeContext(
      Instant createTimeEnd,
      Instant createTimeStart,
      String dateType,
      List<YearMonth> months,
      String selectedDate,
      LocalDateTime timeFrom,
      LocalDateTime timeTo) {}

  private record AnalyticsContractTotals(int expiring, int normal, int retreated) {}

  private record MeterDeviceSnapshot(String address, String comAddress, String piplineName) {}

  private record MeterReadingSnapshot(
      String comAddress,
      Object dataValue,
      Object dataValue1,
      Object dataValue2,
      Object dataValue3,
      Object dataValue4,
      LocalDateTime freezeTime) {}

  private record ProjectMonthReference(int start, int end, int key) {}

  private record RevenuePeriod(List<YearMonth> months, String label) {}
}
