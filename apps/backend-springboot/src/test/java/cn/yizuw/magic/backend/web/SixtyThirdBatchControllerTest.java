package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.factory.FactoryController;
import cn.yizuw.magic.backend.factory.FactoryService;
import cn.yizuw.magic.backend.factory.FactoryUpdateRequest;
import cn.yizuw.magic.backend.park.ParkCreateRequest;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.SystemParkController;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十三批旧厂房更新、系统园区新增和旧园区删除兼容接口测试。 */
class SixtyThirdBatchControllerTest {

  private FactoryService factoryService;
  private MockMvc mockMvc;
  private ParkService parkService;

  @BeforeEach
  void setUp() {
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FactoryController(factoryService), new SystemParkController(parkService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void legacyFactoryUpdateReturnsUpdatedMainRecord() throws Exception {
    when(factoryService.updateFactory(eq(17), any(FactoryUpdateRequest.class)))
        .thenReturn(Map.of("factoryId", 17, "factoryName", "A栋厂房", "parkId", 3));

    mockMvc
        .perform(
            put("/factory/17")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "factoryName":"A栋厂房",
                      "parkId":3,
                      "address":"深圳市宝安区",
                      "contact":"张三",
                      "floors":[{"floorName":"1层","images":[{"imgId":1}]}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(17))
        .andExpect(jsonPath("$.data.factoryName").value("A栋厂房"));

    verify(factoryService).updateFactory(eq(17), any(FactoryUpdateRequest.class));
  }

  @Test
  void systemParkCreateReturnsCreatedPark() throws Exception {
    when(parkService.createLegacyPark(any(ParkCreateRequest.class)))
        .thenReturn(
            Map.of(
                "address",
                "深圳市南山区",
                "area",
                new BigDecimal("56000.00"),
                "dormitories",
                List.of(),
                "factories",
                List.of(),
                "parkId",
                18,
                "parkName",
                "南山产业园"));

    mockMvc
        .perform(
            post("/system/park")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parkName":"南山产业园",
                      "address":"深圳市南山区",
                      "area":56000,
                      "description":"第六十三批测试",
                      "status":"运营中",
                      "factories":[{"factoryName":"旧嵌套厂房"}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(18))
        .andExpect(jsonPath("$.data.parkName").value("南山产业园"));

    verify(parkService).createLegacyPark(any(ParkCreateRequest.class));
  }

  @Test
  void legacyParkDeleteUsesSoftDeleteBoundary() throws Exception {
    when(parkService.deleteSystemPark(19))
        .thenReturn(Map.of("parkId", 19, "parkName", "待删除园区", "isDeleted", true));

    mockMvc
        .perform(delete("/park/19"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(19))
        .andExpect(jsonPath("$.data.isDeleted").value(true));

    verify(parkService).deleteSystemPark(19);
  }
}
