package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.organization.OrganizationController;
import cn.yizuw.magic.backend.organization.OrganizationInvitationCreateRequest;
import cn.yizuw.magic.backend.organization.OrganizationInvitationJoinRequest;
import cn.yizuw.magic.backend.organization.OrganizationService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十一批组织邀请码创建和加入路由测试。 */
class SeventyFirstBatchControllerTest {

  private MockMvc mockMvc;
  private OrganizationService organizationService;

  @BeforeEach
  void setUp() {
    organizationService = org.mockito.Mockito.mock(OrganizationService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new OrganizationController(organizationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void createOrganizationInvitationReturnsInvitationAndSpace() throws Exception {
    when(organizationService.createInvitation(any(OrganizationInvitationCreateRequest.class)))
        .thenReturn(
            Map.of(
                "invitation",
                Map.of("id", 9, "code", "A1B2C3D4", "roleIds", List.of(2, 3), "status", "active"),
                "organizationSpace",
                Map.of("customerId", "tenant-a", "name", "测试组织")));

    mockMvc
        .perform(
            post("/organization/invitation/create")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "roleIds":[2,3],
                      "maxUses":10,
                      "remark":"新员工入职"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.invitation.code").value("A1B2C3D4"))
        .andExpect(jsonPath("$.data.invitation.roleIds[1]").value(3))
        .andExpect(jsonPath("$.data.organizationSpace.customerId").value("tenant-a"));

    verify(organizationService).createInvitation(any(OrganizationInvitationCreateRequest.class));
  }

  @Test
  void joinOrganizationInvitationReturnsReloginFlag() throws Exception {
    when(organizationService.joinInvitation(any(OrganizationInvitationJoinRequest.class)))
        .thenReturn(
            Map.of(
                "alreadyJoined",
                false,
                "customerId",
                "tenant-a",
                "customerName",
                "测试组织",
                "joined",
                true,
                "organizationSpaceId",
                "tenant-a",
                "organizationSpaceName",
                "测试组织",
                "requiresRelogin",
                true));

    mockMvc
        .perform(
            post("/organization/invitation/join")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "code":"a1b2-c3d4"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.joined").value(true))
        .andExpect(jsonPath("$.data.customerId").value("tenant-a"))
        .andExpect(jsonPath("$.data.requiresRelogin").value(true));

    verify(organizationService).joinInvitation(any(OrganizationInvitationJoinRequest.class));
  }
}
