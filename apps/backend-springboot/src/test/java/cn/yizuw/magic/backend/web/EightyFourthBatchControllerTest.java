package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.access.AccessBrandRequest;
import cn.yizuw.magic.backend.access.AccessController;
import cn.yizuw.magic.backend.access.AccessService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十四批门禁品牌接口，覆盖列表、详情、新增、更新和删除 5 个旧路由。 */
class EightyFourthBatchControllerTest {

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
  void brandListReturnsPagedBrands() throws Exception {
    when(accessService.getBrandList(eq(1), eq(20), eq("海康"), eq("HIK"), eq("http"), eq("true"), eq("false")))
        .thenReturn(
            new PageResult<>(
                List.of(Map.of("accessBrandId", 1, "brandCode", "HIK", "brandName", "海康")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/access/brand/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("brandName", "海康")
                .param("brandCode", "HIK")
                .param("protocolType", "http")
                .param("enabled", "true")
                .param("isDefault", "false"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].accessBrandId").value(1))
        .andExpect(jsonPath("$.data.total").value(1));

    verify(accessService).getBrandList(1, 20, "海康", "HIK", "http", "true", "false");
  }

  @Test
  void brandDetailReturnsBrand() throws Exception {
    when(accessService.getBrandDetail(7))
        .thenReturn(Map.of("accessBrandId", 7, "brandCode", "DEFAULT", "brandName", "默认品牌"));

    mockMvc
        .perform(get("/access/brand/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accessBrandId").value(7))
        .andExpect(jsonPath("$.data.brandName").value("默认品牌"));

    verify(accessService).getBrandDetail(7);
  }

  @Test
  void createBrandReturnsCreatedBrand() throws Exception {
    when(accessService.createBrand(any(AccessBrandRequest.class)))
        .thenReturn(Map.of("accessBrandId", 8, "brandCode", "NEW", "brandName", "新品牌"));

    mockMvc
        .perform(
            post("/access/brand")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "brandName": "新品牌",
                      "brandCode": "new",
                      "enabled": true,
                      "isDefault": false
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accessBrandId").value(8))
        .andExpect(jsonPath("$.data.brandCode").value("NEW"));

    verify(accessService).createBrand(any(AccessBrandRequest.class));
  }

  @Test
  void updateBrandReturnsUpdatedBrand() throws Exception {
    when(accessService.updateBrand(eq(8), any(AccessBrandRequest.class)))
        .thenReturn(Map.of("accessBrandId", 8, "brandCode", "NEW", "isDefault", true));

    mockMvc
        .perform(
            put("/access/brand/8")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"isDefault\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accessBrandId").value(8))
        .andExpect(jsonPath("$.data.isDefault").value(true));

    verify(accessService).updateBrand(eq(8), any(AccessBrandRequest.class));
  }

  @Test
  void deleteBrandReturnsDeletedSnapshot() throws Exception {
    when(accessService.deleteBrand(8))
        .thenReturn(Map.of("accessBrandId", 8, "brandCode", "NEW", "brandName", "新品牌"));

    mockMvc
        .perform(delete("/access/brand/8"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accessBrandId").value(8));

    verify(accessService).deleteBrand(8);
  }
}
