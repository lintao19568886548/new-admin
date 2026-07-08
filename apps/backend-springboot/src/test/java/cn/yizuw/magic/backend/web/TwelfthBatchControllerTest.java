package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.reimbursement.ReimbursementController;
import cn.yizuw.magic.backend.reimbursement.ReimbursementService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十二批报销只读接口的路由、参数绑定和响应协议测试。 */
class TwelfthBatchControllerTest {

  private MockMvc mockMvc;
  private ReimbursementService reimbursementService;

  @BeforeEach
  void setUp() {
    reimbursementService = org.mockito.Mockito.mock(ReimbursementService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new ReimbursementController(reimbursementService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void reimbursementListReturnsPagedRows() throws Exception {
    when(reimbursementService.getList(
            eq("张三"),
            eq("行政部"),
            eq("2026-06-30"),
            eq(2),
            eq(15),
            eq("李四"),
            eq(3),
            eq("差旅"),
            eq("2026-06-01"),
            eq(0)))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "id",
                        8,
                        "purpose",
                        "差旅",
                        "amount",
                        new BigDecimal("300.00"),
                        "park",
                        "科技园")),
                1,
                2,
                15));

    mockMvc
        .perform(
            get("/reimbursement/list")
                .param("claimant", "张三")
                .param("department", "行政部")
                .param("endDate", "2026-06-30")
                .param("pageNo", "2")
                .param("pageSize", "15")
                .param("payee", "李四")
                .param("parkId", "3")
                .param("purpose", "差旅")
                .param("startDate", "2026-06-01")
                .param("status", "0"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].id").value(8))
        .andExpect(jsonPath("$.data.items[0].purpose").value("差旅"));
  }

  @Test
  void reimbursementDetailReturnsRecord() throws Exception {
    when(reimbursementService.getDetail(8))
        .thenReturn(Map.of("id", 8, "purpose", "差旅", "images", List.of("/uploads/a.jpg")));

    mockMvc
        .perform(get("/reimbursement/8"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(8))
        .andExpect(jsonPath("$.data.images[0]").value("/uploads/a.jpg"));
  }

  @Test
  void reimbursementPendingCountReturnsCount() throws Exception {
    when(reimbursementService.getPendingCount()).thenReturn(Map.of("count", 6L));

    mockMvc
        .perform(get("/reimbursement/pending-count"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.count").value(6));
  }

  @Test
  void reimbursementSummaryReturnsStatusCounts() throws Exception {
    when(reimbursementService.getSummary(
            eq(null),
            eq("行政部"),
            eq("2026-06-30"),
            eq(3),
            eq(null),
            eq("差旅"),
            eq("2026-06-01"),
            eq(null)))
        .thenReturn(Map.of("approved", 2, "pending", 3, "rejected", 1, "total", 6));

    mockMvc
        .perform(
            get("/reimbursement/summary")
                .param("department", "行政部")
                .param("endDate", "2026-06-30")
                .param("parkId", "3")
                .param("purpose", "差旅")
                .param("startDate", "2026-06-01"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.pending").value(3))
        .andExpect(jsonPath("$.data.total").value(6));
  }

  @Test
  void reimbursementAnalysisReturnsSummaryAndTrend() throws Exception {
    when(reimbursementService.getAnalysis(eq("2026-06-30"), eq(3), eq("2026-06-01"), eq(1)))
        .thenReturn(
            Map.of(
                "parkStats",
                List.of(Map.of("parkId", 3, "park", "科技园", "count", 2, "totalAmount", 500)),
                "summary",
                Map.of("averageAmount", 250, "count", 2, "parkCount", 1, "totalAmount", 500),
                "topParks",
                List.of(Map.of("parkId", 3, "park", "科技园", "ratio", 1)),
                "trend",
                List.of(Map.of("date", "2026-06-01", "count", 2, "totalAmount", 500))));

    mockMvc
        .perform(
            get("/reimbursement/analysis")
                .param("endDate", "2026-06-30")
                .param("parkId", "3")
                .param("startDate", "2026-06-01")
                .param("status", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.count").value(2))
        .andExpect(jsonPath("$.data.trend[0].date").value("2026-06-01"));
    verify(reimbursementService).getAnalysis("2026-06-30", 3, "2026-06-01", 1);
  }
}
