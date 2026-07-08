package cn.yizuw.magic.backend.agent;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Agent 工作台接口；Chat 在迁移期只返回本地兼容结果，不执行真实 Agent runner 或模型调用。 */
@RestController
public class AgentController {

  private final AgentService agentService;

  public AgentController(AgentService agentService) {
    this.agentService = agentService;
  }

  /** 返回 Spring Boot 本地注册的 Agent Skill 定义。 */
  @GetMapping("/agent/skills")
  public ApiResponse<Map<String, Object>> skills() {
    return ApiResponse.ok(agentService.getSkills());
  }

  /** 查询当前登录用户的 Agent 任务列表。 */
  @GetMapping("/agent/tasks")
  public ApiResponse<Map<String, Object>> tasks(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(agentService.getTasks(currentPage, page, pageSize, status));
  }

  /** 查询当前登录用户有权访问的 Agent 任务详情和步骤。 */
  @GetMapping("/agent/tasks/{id}")
  public ApiResponse<Map<String, Object>> taskDetail(@PathVariable String id) {
    return ApiResponse.ok(agentService.getTaskDetail(id));
  }

  /** Agent Chat 本地兼容入口；不执行真实 Agent runner 或 LLM 调用。 */
  @PostMapping("/agent/chat")
  public ApiResponse<Map<String, Object>> chat(
      @RequestBody(required = false) AgentChatRequest request) {
    return ApiResponse.ok(agentService.chat(request));
  }
}
