package cn.yizuw.magic.backend.llm;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 通用大模型兼容接口；迁移期不直接代理外部模型供应商。 */
@RestController
public class ChatController {

  private final LlmService llmService;

  public ChatController(LlmService llmService) {
    this.llmService = llmService;
  }

  /** 智谱 Chat 兼容入口；不读取 apikey，不请求 open.bigmodel.cn。 */
  @PostMapping("/chat/zhipu")
  public ApiResponse<Map<String, Object>> chatZhipu(
      @RequestBody(required = false) ChatZhipuRequest request) {
    return ApiResponse.ok(llmService.chatZhipu(request));
  }
}
