package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.bill.AmountBillController;
import cn.yizuw.magic.backend.bill.AmountBillService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十一批租赁/账单只读接口的路由、参数绑定和响应协议测试。 */
class EleventhBatchControllerTest {

  private AmountBillService amountBillService;
  private MockMvc mockMvc;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    amountBillService = org.mockito.Mockito.mock(AmountBillService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new RentalTenantController(rentalTenantService),
                new AmountBillController(amountBillService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void rentalTenantListReturnsPagedTenants() throws Exception {
    when(rentalTenantService.getTenantList(
            eq("深圳"),
            eq("2026-01-01,2026-12-31"),
            eq(null),
            eq(null),
            eq("expiring"),
            eq(1),
            eq(null),
            eq("2026-06-27"),
            eq("2026-06-01,2026-06-30"),
            eq("5"),
            eq(20),
            eq(3),
            eq("138"),
            eq("active"),
            eq("张三"),
            eq("true")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "rentalTenantId",
                        9,
                        "tenantName",
                        "张三",
                        "phoneNumber",
                        "13800000000",
                        "rent",
                        new BigDecimal("1200.00"))),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/rental/tenant/list")
                .param("address", "深圳")
                .param("contractDate", "2026-01-01,2026-12-31")
                .param("contractView", "expiring")
                .param("currentPage", "1")
                .param("date", "2026-06-27")
                .param("increaseDate", "2026-06-01,2026-06-30")
                .param("increaseRate", "5")
                .param("pageSize", "20")
                .param("parkId", "3")
                .param("phoneNumber", "138")
                .param("status", "active")
                .param("tenantName", "张三")
                .param("transactionType", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].rentalTenantId").value(9))
        .andExpect(jsonPath("$.data.items[0].tenantName").value("张三"));
    verify(rentalTenantService)
        .getTenantList(
            "深圳",
            "2026-01-01,2026-12-31",
            null,
            null,
            "expiring",
            1,
            null,
            "2026-06-27",
            "2026-06-01,2026-06-30",
            "5",
            20,
            3,
            "138",
            "active",
            "张三",
            "true");
  }

  @Test
  void rentalTenantDetailReturnsImages() throws Exception {
    when(rentalTenantService.getTenantDetail(9))
        .thenReturn(
            Map.of(
                "rentalTenantId",
                9,
                "tenantName",
                "张三",
                "images",
                List.of(Map.of("imgId", 2, "url", "/uploads/tenant.jpg"))));

    mockMvc
        .perform(get("/rental/tenant/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalTenantId").value(9))
        .andExpect(jsonPath("$.data.images[0].url").value("/uploads/tenant.jpg"));
  }

  @Test
  void rentalSalaryListReturnsPagedSalaryRows() throws Exception {
    when(rentalTenantService.getSalaryList(
            eq(2), eq(3), eq(Boolean.TRUE), eq("2026-06-01,2026-06-30"), eq(15), eq(null), eq("138"), eq("1200"), eq("张")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "salaryId",
                        6,
                        "rentalTenantId",
                        9,
                        "tenantName",
                        "张三",
                        "salaryAmount",
                        new BigDecimal("1200.00"))),
                1,
                2,
                15));

    mockMvc
        .perform(
            get("/rental/salary/list")
                .param("currentPage", "2")
                .param("currentPark", "3")
                .param("issued", "true")
                .param("issueDate", "2026-06-01,2026-06-30")
                .param("pageSize", "15")
                .param("phoneNumber", "138")
                .param("salaryAmount", "1200")
                .param("tenantName", "张"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].salaryId").value(6))
        .andExpect(jsonPath("$.data.items[0].tenantName").value("张三"));
  }

  @Test
  void rentalSalaryDetailReturnsTenantAndImages() throws Exception {
    when(rentalTenantService.getSalaryDetail(6))
        .thenReturn(
            Map.of(
                "salaryId",
                6,
                "tenantName",
                "张三",
                "tenant",
                Map.of("rentalTenantId", 9, "tenantName", "张三", "phoneNumber", "13800000000"),
                "images",
                List.of(Map.of("imgId", 3, "url", "/uploads/salary.jpg"))));

    mockMvc
        .perform(get("/rental/salary/6"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.salaryId").value(6))
        .andExpect(jsonPath("$.data.tenant.tenantName").value("张三"))
        .andExpect(jsonPath("$.data.images[0].url").value("/uploads/salary.jpg"));
  }

  @Test
  void amountBillProjectOptionsReturnsAutocompleteOptions() throws Exception {
    when(amountBillService.getProjectOptions(eq("6月"), eq(-1), eq(3)))
        .thenReturn(List.of(Map.of("label", "2026年6月房租", "value", "2026年6月房租")));

    mockMvc
        .perform(
            get("/bill/amount/project-options")
                .param("keyword", "6月")
                .param("currentPark", "-1")
                .param("parkId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].label").value("2026年6月房租"));
  }
}
