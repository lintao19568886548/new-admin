package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.auth.AuthCodeLoginRequest;
import cn.yizuw.magic.backend.auth.AuthController;
import cn.yizuw.magic.backend.auth.AuthService;
import cn.yizuw.magic.backend.auth.LoginResponse;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.organization.OrganizationController;
import cn.yizuw.magic.backend.organization.OrganizationCreateRequest;
import cn.yizuw.magic.backend.organization.OrganizationService;
import cn.yizuw.magic.backend.permission.PermissionService;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.multipart.MultipartFile;

/** 第八十三批收尾接口：短信登录、雷达文件导入、公开组织创建。 */
class EightyThirdBatchControllerTest {

  private AuthService authService;
  private InvestmentService investmentService;
  private MockMvc mockMvc;
  private OrganizationService organizationService;

  @BeforeEach
  void setUp() {
    authService = org.mockito.Mockito.mock(AuthService.class);
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    organizationService = org.mockito.Mockito.mock(OrganizationService.class);
    PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AuthController(authService, permissionService),
                new InvestmentController(investmentService),
                new OrganizationController(organizationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void codeLoginReturnsTokenAndRefreshCookie() throws Exception {
    when(authService.codeLogin(any(AuthCodeLoginRequest.class), any(HttpServletResponse.class)))
        .thenAnswer(
            invocation -> {
              HttpServletResponse response = invocation.getArgument(1);
              response.addHeader(
                  HttpHeaders.SET_COOKIE, "jwt=refresh-token; Max-Age=604800; Path=/; HttpOnly");
              return new LoginResponse(
                  "access-token",
                  100L,
                  List.of("dashboard:access"),
                  "public",
                  "/workspace",
                  200L,
                  List.of(),
                  "13800000000",
                  0,
                  "13800000000",
                  0,
                  List.of("User"),
                  1L,
                  "13800000000");
            });

    mockMvc
        .perform(
            post("/auth/code-login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phoneNumber\":\"13800000000\",\"code\":\"123456\"}"))
        .andExpect(status().isOk())
        .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("jwt=")))
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accessToken").value("access-token"))
        .andExpect(jsonPath("$.data.customerId").value("public"))
        .andExpect(jsonPath("$.data.phone").value("13800000000"));

    verify(authService).codeLogin(any(AuthCodeLoginRequest.class), any(HttpServletResponse.class));
  }

  @Test
  void importRadarLeadsFileAcceptsMultipartCsv() throws Exception {
    when(investmentService.importRadarLeadsFile(any(MultipartFile.class)))
        .thenReturn(Map.of("failItems", List.of(), "leadIds", List.of(21), "success", 1));
    MockMultipartFile file =
        new MockMultipartFile(
            "file",
            "leads.csv",
            "text/csv",
            "enterpriseName,phoneNumber\n测试企业,13800000000\n".getBytes(StandardCharsets.UTF_8));

    mockMvc
        .perform(multipart("/investment/radar/lead/import-file").file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.success").value(1))
        .andExpect(jsonPath("$.data.leadIds[0]").value(21));

    verify(investmentService).importRadarLeadsFile(any(MultipartFile.class));
  }

  @Test
  void createOrganizationReturnsSourceOrganization() throws Exception {
    when(organizationService.createOrganization(any(OrganizationCreateRequest.class)))
        .thenReturn(
            Map.of(
                "sourceOrganization",
                Map.of(
                    "city",
                    "深圳",
                    "companyShortName",
                    "示例科技",
                    "id",
                    7,
                    "memberRole",
                    "owner",
                    "name",
                    "示例科技",
                    "sourceCustomerId",
                    "public"),
                "sourceOrganizationCount",
                1));

    mockMvc
        .perform(
            post("/organization/create")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "organizationIdentity": {
                        "city": "深圳",
                        "companyShortName": "示例科技"
                      }
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.sourceOrganization.id").value(7))
        .andExpect(jsonPath("$.data.sourceOrganization.memberRole").value("owner"))
        .andExpect(jsonPath("$.data.sourceOrganizationCount").value(1));

    verify(organizationService).createOrganization(any(OrganizationCreateRequest.class));
  }
}
