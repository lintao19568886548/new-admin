package cn.yizuw.magic.backend.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 智能客服 SSE 兼容接口；迁移期只返回本地流式文本，不请求百炼。 */
@RestController
public class SmartServiceChatController {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final MediaType TEXT_EVENT_STREAM_UTF8 =
      new MediaType(MediaType.TEXT_EVENT_STREAM, StandardCharsets.UTF_8);

  @PostMapping("/smart-service/chat")
  public ResponseEntity<String> chat(@RequestBody(required = false) Map<String, Object> body) {
    List<Map<String, Object>> messages = normalizeMessages(body == null ? null : body.get("messages"));
    if (messages.isEmpty() || !"user".equals(messages.get(messages.size() - 1).get("role"))) {
      return ResponseEntity.badRequest()
          .contentType(TEXT_EVENT_STREAM_UTF8)
          .body(
              sse(
                  Map.of(
                      "error",
                      Map.of("message", "请输入需要咨询的问题", "type", "bad_request"))));
    }
    String question = String.valueOf(messages.get(messages.size() - 1).get("content"));
    String answer = presetReply(question);
    return ResponseEntity.ok()
        .contentType(TEXT_EVENT_STREAM_UTF8)
        .header("Cache-Control", "no-cache, no-transform")
        .header("X-Accel-Buffering", "no")
        .body(sse(Map.of("choices", List.of(Map.of("delta", Map.of("content", answer))))));
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> normalizeMessages(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream()
        .filter(Map.class::isInstance)
        .map(item -> (Map<String, Object>) item)
        .map(
            item -> {
              String content = item.get("content") == null ? "" : String.valueOf(item.get("content")).trim();
              if (!StringUtils.hasText(content)) {
                return null;
              }
              String role = item.get("role") == null ? "" : String.valueOf(item.get("role")).trim();
              if (!List.of("assistant", "system", "user").contains(role)) {
                role = "user";
              }
              return Map.<String, Object>of("content", content.substring(0, Math.min(content.length(), 4000)), "role", role);
            })
        .filter(item -> item != null)
        .skip(Math.max(0, list.size() - 12L))
        .toList();
  }

  private String presetReply(String question) {
    String normalized = question == null ? "" : question.replaceAll("\\s+", "");
    if (normalized.contains("忘记密码") || normalized.contains("找回密码") || normalized.contains("重置密码")) {
      return "您好，您可以在登录页面点击“忘记密码”，通过绑定的手机号验证后重置密码。";
    }
    if (normalized.contains("报修") || normalized.contains("工单")) {
      return "您好，可以在报修工单页面查看或提交工单；涉及具体进度时，请进入对应工单详情核对。";
    }
    if (normalized.contains("支付") || normalized.contains("微信")) {
      return "您好，当前系统支持微信支付在线缴费；具体订单状态请在支付或账单页面核对。";
    }
    return "您好，当前 Spring Boot 迁移期智能客服使用本地兼容回复，未调用外部 AI 服务。请在对应业务页面核对实时数据，或联系人工客服协助处理。";
  }

  private String sse(Map<String, Object> payload) {
    return "data: " + toJson(payload) + "\n\n" + "data: [DONE]\n\n";
  }

  private String toJson(Map<String, Object> payload) {
    try {
      return OBJECT_MAPPER.writeValueAsString(payload);
    } catch (Exception error) {
      return "{\"error\":{\"message\":\"智能客服响应失败\",\"type\":\"local_error\"}}";
    }
  }
}
