package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.finance.FinanceController;
import cn.yizuw.magic.backend.finance.FinanceService;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import cn.yizuw.magic.backend.rental.tenant.SalarySyncRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十四批工资同步和财务批量软删接口测试。 */
class SixtyFourthBatchControllerTest {

  private FinanceService financeService;
  private MockMvc mockMvc;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    financeService = org.mockito.Mockito.mock(FinanceService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FinanceController(financeService),
                new RentalTenantController(rentalTenantService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void salarySyncReturnsCreatedAndSkippedCounts() throws Exception {
    when(rentalTenantService.syncSalary(any(SalarySyncRequest.class)))
        .thenReturn(Map.of("created", 2, "skipped", 3, "total", 5));

    mockMvc
        .perform(
            post("/rental/salary/sync")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "currentPark": 3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(5))
        .andExpect(jsonPath("$.data.created").value(2))
        .andExpect(jsonPath("$.data.skipped").value(3));

    verify(rentalTenantService).syncSalary(any(SalarySyncRequest.class));
  }

  @Test
  void financeBulkDeleteReturnsDeletedCount() throws Exception {
    when(financeService.deleteAuthorizedFinances()).thenReturn(Map.of("deletedCount", 4));

    mockMvc
        .perform(delete("/finance"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.deletedCount").value(4));

    verify(financeService).deleteAuthorizedFinances();
  }
}
