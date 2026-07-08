package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.dormitory.DormitoryController;
import cn.yizuw.magic.backend.dormitory.DormitoryCreateRequest;
import cn.yizuw.magic.backend.dormitory.DormitoryService;
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

/** 第六十一批园区和宿舍新增主表接口测试。 */
class SixtyFirstBatchControllerTest {

  private DormitoryService dormitoryService;
  private MockMvc mockMvc;
  private ParkService parkService;

  @BeforeEach
  void setUp() {
    dormitoryService = org.mockito.Mockito.mock(DormitoryService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemParkController(parkService),
                new DormitoryController(dormitoryService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void legacyParkCreateReturnsCreatedPark() throws Exception {
    when(parkService.createLegacyPark(any(ParkCreateRequest.class)))
        .thenReturn(
            Map.of(
                "address",
                "深圳市宝安区",
                "area",
                new BigDecimal("32000.00"),
                "dormitories",
                List.of(),
                "factories",
                List.of(),
                "parkId",
                91,
                "parkName",
                "宝安产业园"));

    mockMvc
        .perform(
            post("/park")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parkName":"宝安产业园",
                      "address":"深圳市宝安区",
                      "area":32000,
                      "description":"第六十一批测试",
                      "status":"运营中",
                      "manager":"张三",
                      "contact":"13800138000"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(91))
        .andExpect(jsonPath("$.data.parkName").value("宝安产业园"));
  }

  @Test
  void dormitoryCreateReturnsCreatedDormitory() throws Exception {
    when(dormitoryService.createDormitory(any(DormitoryCreateRequest.class)))
        .thenReturn(
            Map.of(
                "dormitoryId",
                92,
                "dormitoryName",
                "B栋宿舍",
                "floorCount",
                6,
                "images",
                List.of(),
                "parkId",
                3,
                "totalRooms",
                120));

    mockMvc
        .perform(
            post("/dormitory")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "dormitoryName":"B栋宿舍",
                      "parkId":3,
                      "floorCount":6,
                      "floorHeightFirst":4.5,
                      "floorHeightOther":3.6,
                      "roomArea":28,
                      "totalRooms":120,
                      "usedRoomsFirst":10,
                      "usedRoomsOther":50,
                      "rentPriceFirst":850,
                      "rentPriceOther":650,
                      "remark":"第六十一批测试",
                      "images":[{"imgId":1}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.dormitoryId").value(92))
        .andExpect(jsonPath("$.data.dormitoryName").value("B栋宿舍"))
        .andExpect(jsonPath("$.data.parkId").value(3));
  }
}
