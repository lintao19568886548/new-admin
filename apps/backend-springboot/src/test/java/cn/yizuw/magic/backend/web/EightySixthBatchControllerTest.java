package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.maintenance.MaintenanceController;
import cn.yizuw.magic.backend.maintenance.MaintenanceRepairOrderRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceService;
import cn.yizuw.magic.backend.smartmeter.SmartMeterBrandController;
import cn.yizuw.magic.backend.smartmeter.SmartMeterBrandService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十六批接口：水电表品牌候选/删除，以及报修工单列表、详情、新增 3 个接口。 */
class EightySixthBatchControllerTest {

  private MaintenanceService maintenanceService;
  private MockMvc mockMvc;
  private SmartMeterBrandService smartMeterBrandService;

  @BeforeEach
  void setUp() {
    maintenanceService = org.mockito.Mockito.mock(MaintenanceService.class);
    smartMeterBrandService = org.mockito.Mockito.mock(SmartMeterBrandService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SmartMeterBrandController(smartMeterBrandService),
                new MaintenanceController(maintenanceService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void smartMeterBrandOptionsReturnsCandidates() throws Exception {
    when(smartMeterBrandService.getBrandOptions("brandName", "合", "electric"))
        .thenReturn(List.of(Map.of("label", "合众", "value", "合众")));

    mockMvc
        .perform(
            get("/smart-meter/brand/options")
                .param("field", "brandName")
                .param("keyword", "合")
                .param("meterType", "electric"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].label").value("合众"))
        .andExpect(jsonPath("$.data[0].value").value("合众"));

    verify(smartMeterBrandService).getBrandOptions("brandName", "合", "electric");
  }

  @Test
  void deleteSmartMeterBrandReturnsDeletedSnapshot() throws Exception {
    when(smartMeterBrandService.deleteBrand(8))
        .thenReturn(Map.of("meterBrandId", 8, "brandCode", "HZ", "brandName", "合众"));

    mockMvc
        .perform(delete("/smart-meter/brand/8"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.meterBrandId").value(8))
        .andExpect(jsonPath("$.data.brandCode").value("HZ"));

    verify(smartMeterBrandService).deleteBrand(8);
  }

  @Test
  void repairOrderListReturnsPagedOrders() throws Exception {
    when(maintenanceService.getRepairOrderList(
            eq(1),
            eq(20),
            eq(3),
            eq(-1),
            eq(5),
            eq("租户"),
            eq("电路"),
            eq("待接单"),
            eq("紧急"),
            eq("张工"),
            eq("RO"),
            eq("2026-01-01 00:00:00"),
            eq("2026-01-31 23:59:59")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "orderNo",
                        "RO202601010001",
                        "park",
                        "科技园",
                        "repairOrderId",
                        11,
                        "status",
                        "待接单")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/maintenance/repair-order/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("parkId", "3")
                .param("currentPark", "-1")
                .param("factoryId", "5")
                .param("tenantName", "租户")
                .param("repairType", "电路")
                .param("status", "待接单")
                .param("priority", "紧急")
                .param("assignee", "张工")
                .param("orderNo", "RO")
                .param("startTime", "2026-01-01 00:00:00")
                .param("endTime", "2026-01-31 23:59:59"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].repairOrderId").value(11))
        .andExpect(jsonPath("$.data.items[0].orderNo").value("RO202601010001"))
        .andExpect(jsonPath("$.data.total").value(1));

    verify(maintenanceService)
        .getRepairOrderList(
            1,
            20,
            3,
            -1,
            5,
            "租户",
            "电路",
            "待接单",
            "紧急",
            "张工",
            "RO",
            "2026-01-01 00:00:00",
            "2026-01-31 23:59:59");
  }

  @Test
  void repairOrderDetailReturnsOrder() throws Exception {
    when(maintenanceService.getRepairOrderDetail(11))
        .thenReturn(
            Map.of(
                "orderNo", "RO202601010001", "repairOrderId", 11, "status", "待接单"));

    mockMvc
        .perform(get("/maintenance/repair-order/11"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.repairOrderId").value(11))
        .andExpect(jsonPath("$.data.status").value("待接单"));

    verify(maintenanceService).getRepairOrderDetail(11);
  }

  @Test
  void createRepairOrderReturnsCreatedOrder() throws Exception {
    when(maintenanceService.createRepairOrder(any(MaintenanceRepairOrderRequest.class)))
        .thenReturn(
            Map.of(
                "orderNo",
                "RO202601010002",
                "priority",
                "普通",
                "repairOrderId",
                12,
                "status",
                "待接单"));

    mockMvc
        .perform(
            post("/maintenance/repair-order")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "factoryId": 5,
                      "parkId": 3,
                      "repairType": "电路",
                      "description": "灯具故障",
                      "priority": "普通",
                      "status": "待接单"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.repairOrderId").value(12))
        .andExpect(jsonPath("$.data.orderNo").value("RO202601010002"));

    verify(maintenanceService).createRepairOrder(any(MaintenanceRepairOrderRequest.class));
  }
}
