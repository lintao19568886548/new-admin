package cn.yizuw.magic.backend.agent;

import java.util.List;
import java.util.Map;

/** Agent Chat 请求；迁移期只做本地兼容响应，不执行真实 Agent runner。 */
public record AgentChatRequest(
    Object agentId,
    Map<String, Object> context,
    List<Map<String, Object>> messages,
    Object model) {}
