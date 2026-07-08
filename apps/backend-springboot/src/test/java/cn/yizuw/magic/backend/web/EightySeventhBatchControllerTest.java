package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.agent.AgentController;
import cn.yizuw.magic.backend.agent.AgentService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.maintenance.MaintenanceController;
import cn.yizuw.magic.backend.maintenance.MaintenanceRepairOrderRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十七批接口：报修工单更新/删除和 Agent 任务中心 3 个只读接口。 */
class EightySeventhBatchControllerTest {

  private AgentService agentService;
  private MaintenanceService maintenanceService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    agentService = org.mockito.Mockito.mock(AgentService.class);
    maintenanceService = org.mockito.Mockito.mock(MaintenanceService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new MaintenanceController(maintenanceService), new AgentController(agentService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void updateRepairOrderReturnsUpdatedOrder() throws Exception {
    when(maintenanceService.updateRepairOrder(eq(11), any(MaintenanceRepairOrderRequest.class)))
        .thenReturn(Map.of("repairOrderId", 11, "status", "处理中", "assignee", "张工"));

    mockMvc
        .perform(
            put("/maintenance/repair-order/11")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "status": "处理中",
                      "assignee": "张工",
                      "assigneePhone": "13800000000"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.repairOrderId").value(11))
        .andExpect(jsonPath("$.data.status").value("处理中"));

    verify(maintenanceService).updateRepairOrder(eq(11), any(MaintenanceRepairOrderRequest.class));
  }

  @Test
  void deleteRepairOrderReturnsDeletedSnapshot() throws Exception {
    when(maintenanceService.deleteRepairOrder(11))
        .thenReturn(Map.of("repairOrderId", 11, "orderNo", "RO202607020001"));

    mockMvc
        .perform(delete("/maintenance/repair-order/11"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.repairOrderId").value(11))
        .andExpect(jsonPath("$.data.orderNo").value("RO202607020001"));

    verify(maintenanceService).deleteRepairOrder(11);
  }

  @Test
  void agentSkillsReturnsBuiltinSkills() throws Exception {
    when(agentService.getSkills())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "description",
                        "将 Agent 工作台消息发送给统一 LLM Adapter 并返回业务回复",
                        "enabled",
                        true,
                        "name",
                        "llm_chat_response",
                        "requiresApproval",
                        false,
                        "riskLevel",
                        "low",
                        "title",
                        "工作台业务回复"))));

    mockMvc
        .perform(get("/agent/skills"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].name").value("llm_chat_response"))
        .andExpect(jsonPath("$.data.items[0].enabled").value(true));

    verify(agentService).getSkills();
  }

  @Test
  void agentTasksReturnsCurrentUserTasks() throws Exception {
    when(agentService.getTasks(2, null, 10, "running"))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("agentCode", "operations", "id", "agt_1", "status", "running")),
                "total",
                1));

    mockMvc
        .perform(
            get("/agent/tasks")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("status", "running"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].id").value("agt_1"))
        .andExpect(jsonPath("$.data.total").value(1));

    verify(agentService).getTasks(2, null, 10, "running");
  }

  @Test
  void agentTaskDetailReturnsTaskAndSteps() throws Exception {
    when(agentService.getTaskDetail("agt_1"))
        .thenReturn(
            Map.of(
                "steps",
                List.of(Map.of("id", "ags_1", "status", "succeeded", "stepNo", 1)),
                "task",
                Map.of("agentCode", "operations", "id", "agt_1", "status", "succeeded")));

    mockMvc
        .perform(get("/agent/tasks/agt_1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.task.id").value("agt_1"))
        .andExpect(jsonPath("$.data.steps[0].id").value("ags_1"));

    verify(agentService).getTaskDetail("agt_1");
  }
}
