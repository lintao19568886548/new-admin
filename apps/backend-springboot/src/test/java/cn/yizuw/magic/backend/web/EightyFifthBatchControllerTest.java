package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.smartmeter.SmartMeterBrandController;
import cn.yizuw.magic.backend.smartmeter.SmartMeterBrandRequest;
import cn.yizuw.magic.backend.smartmeter.SmartMeterBrandService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十五批品牌配置接口：门禁品牌候选和水电表品牌主表 4 个接口。 */
class EightyFifthBatchControllerTest {

  private AccessService accessService;
  private MockMvc mockMvc;
  private SmartMeterBrandService smartMeterBrandService;

  @BeforeEach
  void setUp() {
    accessService = org.mockito.Mockito.mock(AccessService.class);
    smartMeterBrandService = org.mockito.Mockito.mock(SmartMeterBrandService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AccessController(accessService),
                new SmartMeterBrandController(smartMeterBrandService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void accessBrandOptionsReturnsCandidates() throws Exception {
    when(accessService.getBrandOptions("brandName", "海"))
        .thenReturn(List.of(Map.of("label", "海康", "value", "海康")));

    mockMvc
        .perform(get("/access/brand/options").param("field", "brandName").param("keyword", "海"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].label").value("海康"))
        .andExpect(jsonPath("$.data[0].value").value("海康"));

    verify(accessService).getBrandOptions("brandName", "海");
  }

  @Test
  void smartMeterBrandListReturnsPagedBrands() throws Exception {
    when(smartMeterBrandService.getBrandList(
            eq(1), eq(20), eq("electric"), eq("合众"), eq("HZ"), eq("http"), eq("true"), eq("false")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "brandCode",
                        "HZ",
                        "brandName",
                        "合众",
                        "meterBrandId",
                        3,
                        "meterType",
                        "electric")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/smart-meter/brand/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("meterType", "electric")
                .param("brandName", "合众")
                .param("brandCode", "HZ")
                .param("protocolType", "http")
                .param("enabled", "true")
                .param("isDefault", "false"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].meterBrandId").value(3))
        .andExpect(jsonPath("$.data.items[0].meterType").value("electric"))
        .andExpect(jsonPath("$.data.total").value(1));

    verify(smartMeterBrandService)
        .getBrandList(1, 20, "electric", "合众", "HZ", "http", "true", "false");
  }

  @Test
  void smartMeterBrandDetailReturnsBrand() throws Exception {
    when(smartMeterBrandService.getBrandDetail(3))
        .thenReturn(Map.of("meterBrandId", 3, "meterType", "water", "brandName", "水表品牌"));

    mockMvc
        .perform(get("/smart-meter/brand/3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.meterBrandId").value(3))
        .andExpect(jsonPath("$.data.meterType").value("water"));

    verify(smartMeterBrandService).getBrandDetail(3);
  }

  @Test
  void createSmartMeterBrandReturnsCreatedBrand() throws Exception {
    when(smartMeterBrandService.createBrand(any(SmartMeterBrandRequest.class)))
        .thenReturn(Map.of("meterBrandId", 9, "meterType", "electric", "brandCode", "NEW"));

    mockMvc
        .perform(
            post("/smart-meter/brand")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "meterType": "electric",
                      "brandName": "新电表",
                      "brandCode": "new",
                      "isDefault": true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.meterBrandId").value(9))
        .andExpect(jsonPath("$.data.brandCode").value("NEW"));

    verify(smartMeterBrandService).createBrand(any(SmartMeterBrandRequest.class));
  }

  @Test
  void updateSmartMeterBrandReturnsUpdatedBrand() throws Exception {
    when(smartMeterBrandService.updateBrand(eq(9), any(SmartMeterBrandRequest.class)))
        .thenReturn(Map.of("meterBrandId", 9, "meterType", "electric", "enabled", false));

    mockMvc
        .perform(
            put("/smart-meter/brand/9")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"enabled\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.meterBrandId").value(9))
        .andExpect(jsonPath("$.data.enabled").value(false));

    verify(smartMeterBrandService).updateBrand(eq(9), any(SmartMeterBrandRequest.class));
  }
}
