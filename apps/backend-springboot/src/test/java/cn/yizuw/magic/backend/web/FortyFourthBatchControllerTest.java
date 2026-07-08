package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.dormitory.DormitoryController;
import cn.yizuw.magic.backend.dormitory.DormitoryService;
import cn.yizuw.magic.backend.dormitory.DormitoryUpdateRequest;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantUpdateRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十四批租户和宿舍低副作用写接口路由测试。 */
class FortyFourthBatchControllerTest {

  private DormitoryService dormitoryService;
  private MockMvc mockMvc;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    dormitoryService = org.mockito.Mockito.mock(DormitoryService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new RentalTenantController(rentalTenantService),
                new DormitoryController(dormitoryService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void updateTenantReturnsUpdatedTenantSnapshot() throws Exception {
    when(rentalTenantService.updateTenant(eq(18), any(RentalTenantUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "rentalTenantId",
                18,
                "tenantName",
                "深圳宜租",
                "rent",
                new BigDecimal("12500.00"),
                "parkId",
                3));

    mockMvc
        .perform(
            put("/rental/tenant/18")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "tenantName":"深圳宜租",
                      "phoneNumber":"13800000000",
                      "transactionType":true,
                      "contractStart":"2026-06-01",
                      "contractEnd":"2027-05-31",
                      "rent":12500,
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalTenantId").value(18))
        .andExpect(jsonPath("$.data.tenantName").value("深圳宜租"));

    verify(rentalTenantService).updateTenant(eq(18), any(RentalTenantUpdateRequest.class));
  }

  @Test
  void deleteTenantReturnsDeletedTenantSnapshot() throws Exception {
    when(rentalTenantService.deleteTenant(18))
        .thenReturn(
            Map.of(
                "rentalTenantId",
                18,
                "tenantName",
                "深圳宜租",
                "images",
                List.of(Map.of("imgId", 4, "url", "/uploads/tenant.jpg"))));

    mockMvc
        .perform(delete("/rental/tenant/18"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rentalTenantId").value(18))
        .andExpect(jsonPath("$.data.images[0].url").value("/uploads/tenant.jpg"));

    verify(rentalTenantService).deleteTenant(18);
  }

  @Test
  void updateDormitoryReturnsUpdatedDormitorySnapshot() throws Exception {
    when(dormitoryService.updateDormitory(eq(7), any(DormitoryUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "dormitoryId",
                7,
                "dormitoryName",
                "A栋宿舍",
                "floorCount",
                6,
                "parkId",
                2));

    mockMvc
        .perform(
            put("/dormitory/7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "dormitoryName":"A栋宿舍",
                      "floorCount":6,
                      "totalRooms":120,
                      "usedRoomsFirst":8,
                      "usedRoomsOther":50,
                      "parkId":2
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.dormitoryId").value(7))
        .andExpect(jsonPath("$.data.dormitoryName").value("A栋宿舍"));

    verify(dormitoryService).updateDormitory(eq(7), any(DormitoryUpdateRequest.class));
  }

  @Test
  void deleteDormitoryReturnsDeletedDormitorySnapshot() throws Exception {
    when(dormitoryService.deleteDormitory(7))
        .thenReturn(
            Map.of(
                "dormitoryId",
                7,
                "dormitoryName",
                "A栋宿舍",
                "images",
                List.of(Map.of("imgId", 2, "url", "/uploads/dormitory.jpg"))));

    mockMvc
        .perform(delete("/dormitory/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.dormitoryId").value(7))
        .andExpect(jsonPath("$.data.images[0].url").value("/uploads/dormitory.jpg"));

    verify(dormitoryService).deleteDormitory(7);
  }
}
