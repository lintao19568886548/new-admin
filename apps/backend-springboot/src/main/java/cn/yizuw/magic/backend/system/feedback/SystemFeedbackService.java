package cn.yizuw.magic.backend.system.feedback;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SystemFeedbackService {

  private static final Set<String> CATEGORIES = Set.of("bug", "experience", "feature", "other");

  private final SystemFeedbackRepository systemFeedbackRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public SystemFeedbackService(
      SystemFeedbackRepository systemFeedbackRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.systemFeedbackRepository = systemFeedbackRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getFeedbackList(
      String category,
      Integer currentPage,
      String endTime,
      String keyword,
      Integer pageSize,
      String startTime) {
    TenantRequired.currentUser();
    if (category != null && !category.isBlank() && !CATEGORIES.contains(category.trim())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "反馈类型无效");
    }
    return systemFeedbackRepository.findFeedbackPage(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(),
        category,
        currentPage,
        endTime,
        keyword,
        pageSize,
        startTime);
  }
}
