package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.ParkUpdateRequest;
import cn.yizuw.magic.backend.park.SystemParkController;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十五批旧园区路径兼容和触达限制本地导入接口路由测试。 */
class FiftyFifthBatchControllerTest {

  private InvestmentService investmentService;
  private MockMvc mockMvc;
  private ParkService parkService;

  @BeforeEach
  void setUp() {
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new InvestmentController(investmentService), new SystemParkController(parkService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void legacyParkUpdateReusesSystemParkUpdate() throws Exception {
    when(parkService.updateSystemPark(eq(8), any(ParkUpdateRequest.class)))
        .thenReturn(Map.of("address", "深圳", "area", 1800, "parkId", 8, "parkName", "产业园"));

    mockMvc
        .perform(
            put("/park/8")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parkName":"产业园",
                      "address":"深圳",
                      "area":1800,
                      "status":"active"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(8))
        .andExpect(jsonPath("$.data.parkName").value("产业园"));

    verify(parkService).updateSystemPark(eq(8), any(ParkUpdateRequest.class));
  }

  @Test
  void importContactRestrictionsAcceptsArrayBody() throws Exception {
    when(investmentService.importContactRestrictions(any()))
        .thenReturn(
            Map.of(
                "errors",
                List.of(Map.of("index", 1, "message", "restrictionType 不能为空")),
                "failed",
                1,
                "success",
                1,
                "total",
                2));

    mockMvc
        .perform(
            post("/investment/radar/contact-restriction/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    [
                      {
                        "restrictionType":"BLACKLIST",
                        "phoneNumber":"13800138000",
                        "reason":"客户明确拒绝"
                      },
                      {
                        "phoneNumber":"13900139000"
                      }
                    ]
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.success").value(1))
        .andExpect(jsonPath("$.data.failed").value(1))
        .andExpect(jsonPath("$.data.total").value(2));

    verify(investmentService).importContactRestrictions(any());
  }
}
