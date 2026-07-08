package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.factory.FactoryController;
import cn.yizuw.magic.backend.factory.FactoryService;
import cn.yizuw.magic.backend.finance.FinanceController;
import cn.yizuw.magic.backend.finance.FinanceService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十批财务/租赁管理只读接口的路由、参数绑定和响应协议测试。 */
class TenthBatchControllerTest {

  private FactoryService factoryService;
  private FinanceService financeService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    financeService = org.mockito.Mockito.mock(FinanceService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FinanceController(financeService), new FactoryController(factoryService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void financeListReturnsPagedRows() throws Exception {
    when(financeService.getFinanceList(
            eq(">=100"),
            eq("房租"),
            eq("2026年5月"),
            eq(1),
            eq("2026-05-31"),
            eq(20),
            eq(3),
            eq("2026-05-01"),
            eq(0),
            eq("收入")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "financeId",
                        7,
                        "billName",
                        "2026年5月房租",
                        "amount",
                        new BigDecimal("1200.00"),
                        "transactionType",
                        "收入")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/finance/list")
                .param("amount", ">=100")
                .param("billCategory", "房租")
                .param("billName", "2026年5月")
                .param("currentPage", "1")
                .param("endTime", "2026-05-31")
                .param("pageSize", "20")
                .param("parkId", "3")
                .param("startTime", "2026-05-01")
                .param("status", "0")
                .param("transactionType", "收入"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].financeId").value(7))
        .andExpect(jsonPath("$.data.items[0].transactionType").value("收入"));
  }

  @Test
  void financeDetailReturnsFinanceRow() throws Exception {
    when(financeService.getFinanceDetail(7))
        .thenReturn(Map.of("financeId", 7, "billName", "2026年5月房租", "parkId", 3));

    mockMvc
        .perform(get("/finance/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.financeId").value(7))
        .andExpect(jsonPath("$.data.billName").value("2026年5月房租"));
  }

  @Test
  void financeBillNameOptionsReturnsOptions() throws Exception {
    when(financeService.getBillNameOptions(eq("5月"), eq(3), eq(null)))
        .thenReturn(List.of(Map.of("label", "2026年5月房租", "value", "2026年5月房租")));

    mockMvc
        .perform(
            get("/finance/bill-name-options")
                .param("keyword", "5月")
                .param("parkId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].label").value("2026年5月房租"));
  }

  @Test
  void rentalManageListReturnsPagedFactories() throws Exception {
    when(factoryService.getRentalManageList(
            eq("深圳"),
            eq("between,100,200"),
            eq("equal,80"),
            eq("张"),
            eq(2),
            eq(3),
            eq("标准厂房"),
            eq("A栋"),
            eq(15),
            eq("between,20,40")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "factoryId",
                        12,
                        "factoryName",
                        "A栋厂房",
                        "availableArea",
                        new BigDecimal("80.00"))),
                1,
                2,
                15));

    mockMvc
        .perform(
            get("/rental/manage/list")
                .param("address", "深圳")
                .param("area", "between,100,200")
                .param("availableArea", "equal,80")
                .param("contact", "张")
                .param("currentPage", "2")
                .param("currentPark", "3")
                .param("description", "标准厂房")
                .param("factoryName", "A栋")
                .param("pageSize", "15")
                .param("rentPrice", "between,20,40"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].factoryId").value(12));
    verify(factoryService)
        .getRentalManageList(
            "深圳", "between,100,200", "equal,80", "张", 2, 3, "标准厂房", "A栋", 15, "between,20,40");
  }

  @Test
  void rentalManageDetailReturnsFactoryRow() throws Exception {
    when(factoryService.getRentalManageDetail(12))
        .thenReturn(Map.of("factoryId", 12, "factoryName", "A栋厂房", "parkId", 3));

    mockMvc
        .perform(get("/rental/manage/12"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(12))
        .andExpect(jsonPath("$.data.factoryName").value("A栋厂房"));
  }
}
