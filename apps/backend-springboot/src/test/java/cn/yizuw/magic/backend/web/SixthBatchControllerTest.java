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
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六批厂房/租赁园区只读接口的路由与响应协议测试。 */
class SixthBatchControllerTest {

  private FactoryService factoryService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new FactoryController(factoryService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void factoryListReturnsPagedFactoryRows() throws Exception {
    when(factoryService.getFactoryList(eq("深圳"), eq(1), eq("A栋"), eq("true"), eq(20), eq(3)))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "factoryId",
                        11,
                        "factoryName",
                        "A栋厂房",
                        "availableArea",
                        new BigDecimal("88.50"),
                        "imageUrls",
                        List.of("/uploads/factory-a.jpg"))),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/factory/list")
                .param("address", "深圳")
                .param("currentPage", "1")
                .param("factoryName", "A栋")
                .param("isOwn", "true")
                .param("pageSize", "20")
                .param("parkId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].factoryId").value(11))
        .andExpect(jsonPath("$.data.items[0].factoryName").value("A栋厂房"))
        .andExpect(jsonPath("$.data.items[0].imageUrls[0]").value("/uploads/factory-a.jpg"));
  }

  @Test
  void availableFactoryListReturnsOnlyAvailableFactories() throws Exception {
    when(factoryService.getAvailableFactoryList(
            eq(null), eq(1), eq("待租"), eq(null), eq(9), eq(null)))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "factoryId",
                        12,
                        "factoryName",
                        "待租厂房",
                        "availableArea",
                        new BigDecimal("120.00"),
                        "rentPrice",
                        new BigDecimal("30.00"))),
                1,
                1,
                9));

    mockMvc
        .perform(
            get("/factory/available-list")
                .param("currentPage", "1")
                .param("factoryName", "待租")
                .param("pageSize", "9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].factoryId").value(12))
        .andExpect(jsonPath("$.data.items[0].availableArea").value(120.00));
  }

  @Test
  void factoryDetailReturnsFloorsAndImages() throws Exception {
    when(factoryService.getFactoryDetail(12))
        .thenReturn(
            Map.of(
                "factoryId",
                12,
                "factoryName",
                "待租厂房",
                "totalArea",
                new BigDecimal("200.00"),
                "imageUrls",
                List.of("/uploads/factory-main.jpg"),
                "floors",
                List.of(
                    Map.of(
                        "floorId",
                        101,
                        "floorName",
                        "1层",
                        "totalArea",
                        new BigDecimal("200.00"),
                        "imageUrls",
                        List.of("/uploads/floor-1.jpg")))));

    mockMvc
        .perform(get("/factory/12"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(12))
        .andExpect(jsonPath("$.data.imageUrls[0]").value("/uploads/factory-main.jpg"))
        .andExpect(jsonPath("$.data.floors[0].floorId").value(101));
  }

  @Test
  void factoryListByParkReturnsCascaderTree() throws Exception {
    when(factoryService.getFactoryTreeByPark())
        .thenReturn(
            List.of(
                Map.of(
                    "label",
                    "科技园",
                    "value",
                    3,
                    "children",
                    List.of(Map.of("isLeaf", true, "value", 12, "label", "A栋厂房")))));

    mockMvc
        .perform(get("/factory/list-by-park"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].label").value("科技园"))
        .andExpect(jsonPath("$.data[0].children[0].label").value("A栋厂房"));
  }

  @Test
  void rentalParkListReturnsPagedParkCards() throws Exception {
    when(factoryService.getRentalParkList(eq("深圳"), eq(1), eq("科技"), eq(9), eq("运营中")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "parkId",
                        3,
                        "parkName",
                        "科技园",
                        "address",
                        "深圳",
                        "imgUrl",
                        "/uploads/park.jpg",
                        "factoryCount",
                        2)),
                1,
                1,
                9));

    mockMvc
        .perform(
            get("/rental/park/list")
                .param("address", "深圳")
                .param("currentPage", "1")
                .param("parkName", "科技")
                .param("pageSize", "9")
                .param("status", "运营中"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].parkId").value(3))
        .andExpect(jsonPath("$.data.items[0].imgUrl").value("/uploads/park.jpg"));
    verify(factoryService).getRentalParkList("深圳", 1, "科技", 9, "运营中");
  }
}
