package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.park.ParkImageResponse;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.SystemParkController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import cn.yizuw.magic.backend.system.user.SystemUserController;
import cn.yizuw.magic.backend.system.user.SystemUserService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ThirdBatchControllerTest {

  private MockMvc mockMvc;
  private ParkService parkService;
  private RentalTenantService rentalTenantService;
  private SystemUserService systemUserService;

  @BeforeEach
  void setUp() {
    parkService = org.mockito.Mockito.mock(ParkService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    systemUserService = org.mockito.Mockito.mock(SystemUserService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemParkController(parkService),
                new RentalTenantController(rentalTenantService),
                new SystemUserController(systemUserService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void systemParkListReturnsPagedItems() throws Exception {
    when(parkService.getSystemParkList(eq("between,100,200"), eq("深圳"), eq(1), eq("科技"), eq(20)))
        .thenReturn(
            new PageResult<>(
                List.of(Map.of("parkId", 1, "parkName", "科技园", "address", "深圳")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/system/park/list")
                .param("area", "between,100,200")
                .param("address", "深圳")
                .param("currentPage", "1")
                .param("parkName", "科技")
                .param("pageSize", "20"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.currentPage").value(1))
        .andExpect(jsonPath("$.data.items[0].parkId").value(1))
        .andExpect(jsonPath("$.data.items[0].parkName").value("科技园"));
  }

  @Test
  void systemParkDetailReturnsImagesFactoriesAndDormitories() throws Exception {
    when(parkService.getSystemParkDetail(1))
        .thenReturn(
            Map.of(
                "parkId",
                1,
                "parkName",
                "科技园",
                "images",
                List.of(new ParkImageResponse(9, "park.jpg", "/uploads/park.jpg")),
                "factories",
                List.of(Map.of("factoryId", 2, "floors", List.of(Map.of("floorId", 3)))),
                "dormitories",
                List.of(Map.of("dormitoryId", 4))));

    mockMvc
        .perform(get("/system/park/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(1))
        .andExpect(jsonPath("$.data.images[0].imgId").value(9))
        .andExpect(jsonPath("$.data.factories[0].floors[0].floorId").value(3))
        .andExpect(jsonPath("$.data.dormitories[0].dormitoryId").value(4));
  }

  @Test
  void rentalTenantSelectReturnsTenantIdAndName() throws Exception {
    when(rentalTenantService.getTenantSelectList("all", null))
        .thenReturn(List.of(Map.of("tenantId", 5, "tenantName", "测试租户")));

    mockMvc
        .perform(get("/rental/tenant/select").param("scope", "all"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].tenantId").value(5))
        .andExpect(jsonPath("$.data[0].tenantName").value("测试租户"));
    verify(rentalTenantService).getTenantSelectList("all", null);
  }

  @Test
  void salaryTenantOptionsReturnsActiveContractTenantRows() throws Exception {
    when(rentalTenantService.getSalaryTenantOptions("张"))
        .thenReturn(
            List.of(
                Map.of(
                    "rentalTenantId",
                    6,
                    "tenantName",
                    "张三",
                    "phoneNumber",
                    "13800000000")));

    mockMvc
        .perform(get("/rental/salary/tenant-options").param("keyword", "张"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].rentalTenantId").value(6))
        .andExpect(jsonPath("$.data[0].phoneNumber").value("13800000000"));
  }

  @Test
  void userListReturnsPagedUserRows() throws Exception {
    when(systemUserService.getUserList(eq(1), eq(20), eq("138"), eq("管"), eq("1"), eq("admin")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "id",
                        7,
                        "centerUserId",
                        70,
                        "username",
                        "admin",
                        "realName",
                        "管理员",
                        "roles",
                        List.of("Super"),
                        "parks",
                        List.of(Map.of("parkId", 1, "parkName", "科技园")))),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/user/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("phone", "138")
                .param("realName", "管")
                .param("status", "1")
                .param("username", "admin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].centerUserId").value(70))
        .andExpect(jsonPath("$.data.items[0].roles[0]").value("Super"))
        .andExpect(jsonPath("$.data.items[0].parks[0].parkName").value("科技园"));
  }
}
