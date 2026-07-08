package cn.yizuw.magic.backend.dashboard.overview;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewRepository.EnergyBillRow;
import cn.yizuw.magic.backend.integration.hezhong.HezhongClient;
import cn.yizuw.magic.backend.integration.hezhong.HezhongMeterType;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantContext;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** 第一百六十一批表计统计第三方优先、本地兜底场景测试。 */
class DashboardMeterStatisticsServiceTest {

  private DashboardOverviewRepository dashboardOverviewRepository;
  private HezhongClient hezhongClient;
  private JdbcTemplate jdbcTemplate;
  private ParkScopeService parkScopeService;
  private DashboardOverviewService service;
  private TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  @BeforeEach
  void setUp() {
    dashboardOverviewRepository = org.mockito.Mockito.mock(DashboardOverviewRepository.class);
    hezhongClient = org.mockito.Mockito.mock(HezhongClient.class);
    jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
    parkScopeService = org.mockito.Mockito.mock(ParkScopeService.class);
    tenantJdbcTemplateProvider = org.mockito.Mockito.mock(TenantJdbcTemplateProvider.class);
    service =
        new DashboardOverviewService(
            dashboardOverviewRepository,
            hezhongClient,
            new ObjectMapper(),
            parkScopeService,
            tenantJdbcTemplateProvider);
    TenantContext.set(
        new UserTokenPayload(
            1L,
            "customer-a",
            "customer_a",
            2L,
            List.of(Map.of("parkId", 101, "parkName", "一号园区")),
            0,
            0,
            List.of("Admin"),
            1L,
            "tester"));
    when(tenantJdbcTemplateProvider.currentTenantJdbcTemplate()).thenReturn(jdbcTemplate);
    when(parkScopeService.resolveAuthorizedParks(jdbcTemplate, TenantContext.get()))
        .thenReturn(List.of(Map.of("parkId", 101, "parkName", "一号园区")));
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void electricityDayUsesHezhongDevicesAndReadingsWhenAvailable() {
    when(dashboardOverviewRepository.findEnergyBills(any(), any(), any(), any()))
        .thenReturn(List.of());
    when(hezhongClient.getDevice(
            argThat(
                params ->
                    HezhongMeterType.ELECTRICITY.comType().equals(params.get("comtype"))
                        && "1".equals(params.get("page"))
                        && "1000".equals(params.get("pageSize"))
                        && "999".equals(params.get("projCode")))))
        .thenReturn(
            Map.of(
                "data",
                Map.of(
                    "records",
                    List.of(
                        Map.of(
                            "address",
                            "一号园区/A栋/1层",
                            "comAddress",
                            "E001",
                            "piplineName",
                            "一号园区电表001")),
                    "total",
                    1)));
    when(hezhongClient.getHdmData(
            argThat(
                params ->
                    HezhongMeterType.ELECTRICITY.comType().equals(params.get("comType"))
                        && "1".equals(params.get("page"))
                        && "1000".equals(params.get("pageSize"))
                        && "999".equals(params.get("projCode"))
                        && "2026-07-04 00:00:00".equals(params.get("timeFrom"))
                        && "2026-07-04 23:59:59".equals(params.get("timeTo"))
                        && "1".equals(params.get("type")))))
        .thenReturn(
            Map.of(
                "data",
                Map.of(
                    "records",
                    List.of(
                        Map.of(
                            "comAddress",
                            "E001",
                            "dataValue",
                            "10",
                            "dataValue1",
                            "1",
                            "dataValue2",
                            "2",
                            "dataValue3",
                            "3",
                            "dataValue4",
                            "4",
                            "freezeTime",
                            "2026-07-04 08:00:00")),
                    "total",
                    1)));

    Map<String, Object> result =
        service.getMeterStatistics(
            new MeterStatisticsQuery(
                "2026-07-04", "day", null, "101", null, "electricity", "999"));

    assertThat(result.get("source")).isEqualTo("hezhong_vendor");
    assertThat(result.get("statisticsType")).isEqualTo("electricity");
    assertThat(map(result.get("summary")).get("deviceCount")).isEqualTo(1);
    assertThat(map(result.get("summary")).get("recordCount")).isEqualTo(1);
    assertThat(namedValue(result.get("dayNight"), "时段表")).isEqualTo(10.0);
    assertThat(namedValue(result.get("peakValley"), "尖")).isEqualTo(1.0);
  }

  @Test
  void recoverableHezhongFailureReturnsLocalAmountBillFallback() {
    EnergyBillRow bill =
        new EnergyBillRow(
            7,
            Instant.parse("2026-08-01T00:00:00Z"),
            """
            [{"meterName":"普通表","totalUsage":6}]
            """,
            null,
            new ArrayList<>(),
            new ArrayList<>());
    when(dashboardOverviewRepository.findEnergyBills(any(), any(), any(), any()))
        .thenReturn(List.of(bill));
    when(hezhongClient.getDevice(any()))
        .thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY, "合众平台请求失败"));

    Map<String, Object> result =
        service.getMeterStatistics(
            new MeterStatisticsQuery("2026-07", "month", null, "101", null, "electricity", null));

    assertThat(result.get("source")).isEqualTo("amount_bill_local_fallback");
    assertThat(result.get("message")).isEqualTo("表计平台响应超时，已返回本地可用统计数据");
    assertThat(result.get("hasData")).isEqualTo(true);
    assertThat(map(result.get("summary")).get("recordCount")).isEqualTo(1);
    assertThat(namedValue(result.get("dayNight"), "普通表")).isEqualTo(6.0);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> map(Object value) {
    return (Map<String, Object>) value;
  }

  @SuppressWarnings("unchecked")
  private double namedValue(Object value, String name) {
    return ((List<Map<String, Object>>) value)
        .stream()
            .filter(item -> name.equals(item.get("name")))
            .findFirst()
            .map(item -> ((Number) item.get("value")).doubleValue())
            .orElseThrow();
  }
}
