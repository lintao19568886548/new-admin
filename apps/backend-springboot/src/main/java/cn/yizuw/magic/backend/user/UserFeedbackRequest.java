package cn.yizuw.magic.backend.user;

import java.util.List;
import java.util.Map;

/** 用户个人中心意见反馈提交请求，兼容旧 Nitro `/api/user/feedback.post.ts`。 */
public record UserFeedbackRequest(
    String category,
    String clientPlatform,
    String contact,
    String content,
    List<Map<String, Object>> images) {}
