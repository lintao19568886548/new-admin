package cn.yizuw.magic.backend.user;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** 用户个人中心反馈提交服务，负责参数校验和租户库写入边界。 */
@Service
public class UserFeedbackService {

  private static final Map<String, String> CATEGORY_LABELS =
      Map.of(
          "bug", "问题异常",
          "experience", "体验优化",
          "feature", "功能建议",
          "other", "其他反馈");

  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;
  private final UserFeedbackRepository userFeedbackRepository;

  public UserFeedbackService(
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider,
      UserFeedbackRepository userFeedbackRepository) {
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
    this.userFeedbackRepository = userFeedbackRepository;
  }

  /** 提交意见反馈；该方法只写租户库，不发送通知或调用外部服务。 */
  public Map<String, Object> submit(UserFeedbackRequest request, String userAgent) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (payload.id() == null || payload.id() <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "当前账号信息无效");
    }
    String category = trim(request == null ? null : request.category());
    String content = trim(request == null ? null : request.content());
    String contact = trim(request == null ? null : request.contact());
    String clientPlatform = trim(request == null ? null : request.clientPlatform());
    validate(category, content, contact, clientPlatform);

    List<Integer> imageIds = normalizeImageIds(request == null ? null : request.images());
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    if (!userFeedbackRepository.allImagesExist(jdbcTemplate, imageIds)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "存在无效的反馈图片，请重新上传后再试");
    }

    int feedbackId =
        userFeedbackRepository.createFeedback(
            jdbcTemplate, category, contact, content, clientPlatform, imageIds, userAgent, payload);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("categoryLabel", CATEGORY_LABELS.get(category));
    result.put("feedbackId", feedbackId);
    return result;
  }

  private void validate(String category, String content, String contact, String clientPlatform) {
    if (!CATEGORY_LABELS.containsKey(category)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "反馈类型无效");
    }
    if (content.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请输入反馈内容");
    }
    if (content.length() < 10) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "反馈内容不能少于 10 个字符");
    }
    if (content.length() > 500) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "反馈内容不能超过 500 个字符");
    }
    if (contact.length() > 50) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "联系方式不能超过 50 个字符");
    }
    if (clientPlatform.length() > 20) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "客户端标识无效");
    }
  }

  private List<Integer> normalizeImageIds(List<Map<String, Object>> images) {
    if (images == null || images.isEmpty()) {
      return List.of();
    }
    Set<Integer> ids = new LinkedHashSet<>();
    for (Map<String, Object> image : images) {
      Object value = image == null ? null : image.get("imgId");
      Integer imgId = toPositiveInteger(value);
      if (imgId != null) {
        ids.add(imgId);
      }
    }
    return new ArrayList<>(ids);
  }

  private Integer toPositiveInteger(Object value) {
    if (value instanceof Number number && number.intValue() > 0) {
      return number.intValue();
    }
    if (value instanceof String text) {
      try {
        int parsed = Integer.parseInt(text.trim());
        return parsed > 0 ? parsed : null;
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private String trim(String value) {
    return value == null ? "" : value.trim();
  }
}
