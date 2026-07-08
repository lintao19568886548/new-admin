package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.access.AccessCarUpdateRequest;
import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessDoorStatusRequest;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.access.AccessVisitorUpdateRequest;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十五批门禁低副作用写接口的路由与响应协议测试。 */
class ThirtyFifthBatchControllerTest {

  private AccessService accessService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    accessService = org.mockito.Mockito.mock(AccessService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new AccessController(accessService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void visitorUpdateReturnsUpdatedVisitorRow() throws Exception {
    when(accessService.updateVisitor(eq(7), any(AccessVisitorUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "visitorId",
                7,
                "visitorName",
                "张三",
                "phoneNumber",
                "13800000000",
                "parkName",
                "科技园"));

    mockMvc
        .perform(
            put("/access/visitor/7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "visitorName":"张三",
                      "phoneNumber":"13800000000",
                      "carNum":"粤B12345",
                      "parkId":3,
                      "status":1
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.visitorId").value(7))
        .andExpect(jsonPath("$.data.parkName").value("科技园"));
  }

  @Test
  void visitorDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/access/visitor/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(accessService).deleteVisitor(7);
  }

  @Test
  void carUpdateReturnsUpdatedCarRow() throws Exception {
    when(accessService.updateCar(eq(9), any(AccessCarUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "carId",
                9,
                "carNumber",
                "粤B88888",
                "status",
                1,
                "parkName",
                "科技园"));

    mockMvc
        .perform(
            put("/access/car/9")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "carNumber":"粤B88888",
                      "parkId":3,
                      "status":1,
                      "remark":"月卡车辆"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.carId").value(9))
        .andExpect(jsonPath("$.data.carNumber").value("粤B88888"));
  }

  @Test
  void carDeleteKeepsLegacySuccessEnvelope() throws Exception {
    mockMvc
        .perform(delete("/access/car/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));

    verify(accessService).deleteCar(9);
  }

  @Test
  void doorStatusUpdateReturnsUpdatedDoorRow() throws Exception {
    when(accessService.updateDoorStatus(eq(5), any(AccessDoorStatusRequest.class)))
        .thenReturn(
            Map.of(
                "deviceId",
                5,
                "deviceCode",
                "D-01",
                "deviceName",
                "北门",
                "status",
                1));

    mockMvc
        .perform(
            put("/access/door/5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "status":1
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.deviceId").value(5))
        .andExpect(jsonPath("$.data.status").value(1));
  }
}
