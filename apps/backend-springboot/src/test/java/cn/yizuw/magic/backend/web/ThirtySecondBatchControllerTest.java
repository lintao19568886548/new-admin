package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.bill.AmountBillController;
import cn.yizuw.magic.backend.bill.AmountBillListQuery;
import cn.yizuw.magic.backend.bill.AmountBillService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayController;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十二批总账单、HR 考勤设备/轨迹导出和微信支付公开配置只读接口测试。 */
class ThirtySecondBatchControllerTest {

  private AmountBillService amountBillService;
  private HrmService hrmService;
  private MockMvc mockMvc;
  private WechatPayPublicConfigService wechatPayPublicConfigService;

  @BeforeEach
  void setUp() {
    amountBillService = org.mockito.Mockito.mock(AmountBillService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    wechatPayPublicConfigService = org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AmountBillController(amountBillService),
                new HrmController(hrmService),
                new WechatPayController(wechatPayPublicConfigService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void amountBillListBindsFiltersAndReturnsSummary() throws Exception {
    AmountBillListQuery query =
        new AmountBillListQuery(
            "unreceived", 2, 3, "2026-06-30", 10, "2026-06-30", "房租", "2026-06-01", "2026-06-01", "张三");
    when(amountBillService.getAmountBillList(eq(query)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "billId",
                        9,
                        "collectionStatus",
                        "partial",
                        "projectName",
                        "2026年6月房租",
                        "remainingAmount",
                        300,
                        "tenantName",
                        "张三")),
                "summary",
                Map.of("billCount", 1, "remainingAmount", 300, "totalFee", 1000),
                "total",
                1));

    mockMvc
        .perform(
            get("/bill/amount/list")
                .param("collectionStatus", "unreceived")
                .param("currentPage", "2")
                .param("currentPark", "3")
                .param("endTime", "2026-06-30")
                .param("pageSize", "10")
                .param("projectEndDate", "2026-06-30")
                .param("projectName", "房租")
                .param("projectStartDate", "2026-06-01")
                .param("startTime", "2026-06-01")
                .param("tenantName", "张三"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].billId").value(9))
        .andExpect(jsonPath("$.data.summary.remainingAmount").value(300));

    verify(amountBillService).getAmountBillList(query);
  }

  @Test
  void amountBillDetailReturnsMeterBillsAndParkSnapshot() throws Exception {
    when(amountBillService.getAmountBillDetail(eq(9)))
        .thenReturn(
            Map.of(
                "billId",
                9,
                "eleBills",
                List.of(Map.of("eleId", 3, "meterName", "A1 电表")),
                "park",
                Map.of("manager", "园区经理"),
                "projectName",
                "2026年6月房租",
                "tenant",
                Map.of("tenantName", "张三"),
                "waterBills",
                List.of(Map.of("meterName", "A1 水表", "waterId", 4))));

    mockMvc
        .perform(get("/bill/amount/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.billId").value(9))
        .andExpect(jsonPath("$.data.eleBills[0].meterName").value("A1 电表"))
        .andExpect(jsonPath("$.data.park.manager").value("园区经理"));

    verify(amountBillService).getAmountBillDetail(9);
  }

  @Test
  void attendanceDeviceReturnsCurrentUserAbnormalLogs() throws Exception {
    when(hrmService.getAttendanceDeviceLogs(eq("2026-06-29"), eq(5)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "abnormalType",
                        "device_changed",
                        "abnormalTypes",
                        List.of("device_changed"),
                        "action",
                        "punch_in",
                        "currentDeviceId",
                        "device-2",
                        "id",
                        11)),
                "total",
                1));

    mockMvc
        .perform(get("/hrm/attendance/device").param("date", "2026-06-29").param("limit", "5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].abnormalType").value("device_changed"))
        .andExpect(jsonPath("$.data.total").value(1));

    verify(hrmService).getAttendanceDeviceLogs("2026-06-29", 5);
  }

  @Test
  void trajectoryExportReturnsParkGroupedRows() throws Exception {
    when(hrmService.getTrajectoryExport(eq("张三"), eq("3"), eq("2026-06-01"), eq("2026-06-29")))
        .thenReturn(
            Map.of(
                "测试园区",
                List.of(
                    Map.of(
                        "attendanceId",
                        21,
                        "date",
                        "2026-06-29",
                        "deviceStatus",
                        "normal",
                        "username",
                        "张三"))));

    mockMvc
        .perform(
            get("/hrm/trajectory/export")
                .param("employeeName", "张三")
                .param("parkId", "3")
                .param("startDate", "2026-06-01")
                .param("endDate", "2026-06-29"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.测试园区[0].attendanceId").value(21))
        .andExpect(jsonPath("$.data.测试园区[0].username").value("张三"));

    verify(hrmService).getTrajectoryExport("张三", "3", "2026-06-01", "2026-06-29");
  }

  @Test
  void wechatPayAppConfigReturnsRuntimeConfigStatus() throws Exception {
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(
            Map.of(
                "appId",
                "wx-open-app",
                "configured",
                true,
                "mchId",
                "1900000001",
                "missing",
                List.of()));

    mockMvc
        .perform(get("/wechat/pay/app/config"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.appId").value("wx-open-app"))
        .andExpect(jsonPath("$.data.configured").value(true))
        .andExpect(jsonPath("$.data.mchId").value("1900000001"))
        .andExpect(jsonPath("$.data.missing").isArray());

    verify(wechatPayPublicConfigService).getAppConfigStatus();
  }
}
