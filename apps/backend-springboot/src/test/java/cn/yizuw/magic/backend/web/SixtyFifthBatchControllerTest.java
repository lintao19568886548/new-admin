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
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmEmployeeCreateRequest;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.reimbursement.ReimbursementAuditRequest;
import cn.yizuw.magic.backend.reimbursement.ReimbursementController;
import cn.yizuw.magic.backend.reimbursement.ReimbursementService;
import cn.yizuw.magic.backend.system.role.RoleCreateRequest;
import cn.yizuw.magic.backend.system.role.SystemRoleController;
import cn.yizuw.magic.backend.system.role.SystemRoleService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十五批 HR 员工新增、报销审核/删除和系统角色新增接口测试。 */
class SixtyFifthBatchControllerTest {

  private HrmService hrmService;
  private MockMvc mockMvc;
  private ReimbursementService reimbursementService;
  private SystemRoleService systemRoleService;

  @BeforeEach
  void setUp() {
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    reimbursementService = org.mockito.Mockito.mock(ReimbursementService.class);
    systemRoleService = org.mockito.Mockito.mock(SystemRoleService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new HrmController(hrmService),
                new ReimbursementController(reimbursementService),
                new SystemRoleController(systemRoleService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void createEmployeeReturnsCreatedEmployee() throws Exception {
    when(hrmService.createEmployee(any(HrmEmployeeCreateRequest.class)))
        .thenReturn(
            Map.of(
                "employeeId",
                601,
                "name",
                "张三",
                "gender",
                "男",
                "phone",
                "13800138000"));

    mockMvc
        .perform(
            post("/hrm/employee")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"张三",
                      "gender":"男",
                      "phone":"13800138000",
                      "department":"招商部",
                      "age":30
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.employeeId").value(601))
        .andExpect(jsonPath("$.data.name").value("张三"));

    verify(hrmService).createEmployee(any(HrmEmployeeCreateRequest.class));
  }

  @Test
  void auditReimbursementReturnsUpdatedRecord() throws Exception {
    when(reimbursementService.audit(eq(602), any(ReimbursementAuditRequest.class)))
        .thenReturn(
            Map.of(
                "id",
                602,
                "amount",
                new BigDecimal("88.00"),
                "status",
                1,
                "auditOpinion",
                "审核人：管理员\n通过"));

    mockMvc
        .perform(
            put("/reimbursement/602")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "status":1,
                      "auditOpinion":"通过"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(602))
        .andExpect(jsonPath("$.data.status").value(1));

    verify(reimbursementService).audit(eq(602), any(ReimbursementAuditRequest.class));
  }

  @Test
  void deleteReimbursementReturnsDeletedSnapshot() throws Exception {
    when(reimbursementService.delete(603))
        .thenReturn(Map.of("id", 603, "isDeleted", true, "purpose", "差旅报销"));

    mockMvc
        .perform(delete("/reimbursement/603"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(603))
        .andExpect(jsonPath("$.data.isDeleted").value(true));

    verify(reimbursementService).delete(603);
  }

  @Test
  void createRoleReturnsCreatedRole() throws Exception {
    when(systemRoleService.createRole(any(RoleCreateRequest.class)))
        .thenReturn(
            Map.of(
                "roleId",
                604,
                "name",
                "财务审核",
                "permissions",
                List.of(11, 12),
                "parkIds",
                List.of(3)));

    mockMvc
        .perform(
            post("/system/role")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"财务审核",
                      "status":1,
                      "permissions":[11,12],
                      "parkIds":[3]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.roleId").value(604))
        .andExpect(jsonPath("$.data.permissions[0]").value(11));

    verify(systemRoleService).createRole(any(RoleCreateRequest.class));
  }
}
