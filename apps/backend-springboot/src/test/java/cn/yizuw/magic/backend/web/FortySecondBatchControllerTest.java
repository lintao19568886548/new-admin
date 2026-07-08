package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.CrawlerSourceUpdateRequest;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.InvestmentUpdateRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十二批门禁新增、招商更新和采集源配置更新接口路由测试。 */
class FortySecondBatchControllerTest {

  private AccessService accessService;
  private InvestmentService investmentService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    accessService = org.mockito.Mockito.mock(AccessService.class);
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AccessController(accessService), new InvestmentController(investmentService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void createVisitorReturnsCreatedVisitor() throws Exception {
    when(accessService.createVisitor(any()))
        .thenReturn(
            Map.of(
                "visitorId", 21,
                "visitorName", "张访客",
                "phoneNumber", "13800000000",
                "parkId", 3));

    mockMvc
        .perform(
            post("/access/visitor")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "visitorName":"张访客",
                      "phoneNumber":"13800000000",
                      "carNum":"粤B12345",
                      "status":0,
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.visitorId").value(21))
        .andExpect(jsonPath("$.data.parkId").value(3));

    verify(accessService).createVisitor(any());
  }

  @Test
  void createCarReturnsCreatedCar() throws Exception {
    when(accessService.createCar(any()))
        .thenReturn(Map.of("carId", 31, "carNumber", "粤B99888", "status", 1, "parkId", 2));

    mockMvc
        .perform(
            post("/access/car")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "carNumber":"粤B99888",
                      "status":1,
                      "parkId":2
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.carId").value(31))
        .andExpect(jsonPath("$.data.carNumber").value("粤B99888"));

    verify(accessService).createCar(any());
  }

  @Test
  void createDoorReturnsCreatedDevice() throws Exception {
    when(accessService.createDoor(any()))
        .thenReturn(
            Map.of(
                "deviceId", 41,
                "deviceCode", "DOOR-A01",
                "deviceName", "A门禁",
                "status", 1));

    mockMvc
        .perform(
            post("/access/door")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "deviceCode":"door-a01",
                      "deviceName":"A门禁",
                      "location":"一楼大厅",
                      "parkId":1,
                      "status":1
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.deviceId").value(41))
        .andExpect(jsonPath("$.data.deviceCode").value("DOOR-A01"));

    verify(accessService).createDoor(any());
  }

  @Test
  void updateInvestmentReturnsUpdatedMainRecord() throws Exception {
    when(investmentService.updateInvestment(eq(12), any(InvestmentUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "investmentId", 12,
                "tenantName", "意向客户",
                "progress", "深入沟通",
                "intentLevel", "高"));

    mockMvc
        .perform(
            put("/investment/12")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "tenantName":"意向客户",
                      "progress":"深入沟通",
                      "intentLevel":"高"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.investmentId").value(12))
        .andExpect(jsonPath("$.data.progress").value("深入沟通"));

    verify(investmentService).updateInvestment(eq(12), any(InvestmentUpdateRequest.class));
  }

  @Test
  void updateCrawlerSourceReturnsUpdatedConfig() throws Exception {
    when(investmentService.updateCrawlerSource(eq(5L), any(CrawlerSourceUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "sourceId",
                5,
                "sourceCode",
                "PUBLIC_OPPORTUNITY_99CFW",
                "enabled",
                true,
                "allowedPathsJson",
                List.of("/changfangxuqiu/")));

    mockMvc
        .perform(
            put("/investment/radar/crawler-source/5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "enabled":true,
                      "crawlIntervalMinutes":1440,
                      "rateLimitPerMinute":120,
                      "allowedPathsJson":["/changfangxuqiu/"]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.sourceId").value(5))
        .andExpect(jsonPath("$.data.allowedPathsJson[0]").value("/changfangxuqiu/"));

    verify(investmentService).updateCrawlerSource(eq(5L), any(CrawlerSourceUpdateRequest.class));
  }
}
