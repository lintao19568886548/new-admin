package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.factory.FactoryController;
import cn.yizuw.magic.backend.factory.FactoryService;
import cn.yizuw.magic.backend.factory.RentalManageUpdateRequest;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmLeaveApplicationUpdateRequest;
import cn.yizuw.magic.backend.hrm.HrmService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十八批租赁、HRM 和门禁低副作用写接口的路由与响应协议测试。 */
class ThirtyEighthBatchControllerTest {

  private AccessService accessService;
  private FactoryService factoryService;
  private HrmService hrmService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    accessService = org.mockito.Mockito.mock(AccessService.class);
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AccessController(accessService),
                new FactoryController(factoryService),
                new HrmController(hrmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void rentalManageUpdateReturnsUpdatedFactoryRow() throws Exception {
    when(factoryService.updateRentalManage(eq(12), any(RentalManageUpdateRequest.class)))
        .thenReturn(Map.of("factoryId", 12, "factoryName", "A栋厂房", "parkId", 3));

    mockMvc
        .perform(
            put("/rental/manage/12")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "factoryName":"A栋厂房",
                      "parkId":3,
                      "address":"深圳",
                      "contact":"张三",
                      "isOwn":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(12))
        .andExpect(jsonPath("$.data.factoryName").value("A栋厂房"));
  }

  @Test
  void rentalManageDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/rental/manage/12"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(factoryService).deleteRentalManage(12);
  }

  @Test
  void leaveApplicationUpdateReturnsUpdatedApplicationRow() throws Exception {
    when(hrmService.updateLeaveApplication(eq(9), any(HrmLeaveApplicationUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "id",
                9,
                "user",
                "李四",
                "park",
                "科技园",
                "leaveType",
                "事假",
                "status",
                1));

    mockMvc
        .perform(
            put("/hrm/leaveapplication/9")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "user":"李四",
                      "parkId":3,
                      "startDate":"2026-06-29 09:00:00",
                      "endDate":"2026-06-29 18:00:00",
                      "leaveType":"事假",
                      "status":1,
                      "auditUser":"王五"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(9))
        .andExpect(jsonPath("$.data.park").value("科技园"));
  }

  @Test
  void leaveApplicationDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/hrm/leaveapplication/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(hrmService).deleteLeaveApplication(9);
  }

  @Test
  void doorDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/access/door/5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(accessService).deleteDoor(5);
  }
}
