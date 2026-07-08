package cn.yizuw.magic.backend.localization;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 打卡定位业务层，集中处理旧接口的用户权限边界。 */
@Service
public class LocalizationService {

  private final LocalizationRepository localizationRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public LocalizationService(
      LocalizationRepository localizationRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.localizationRepository = localizationRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /**
   * 查询打卡记录列表。
   *
   * <p>旧实现中非 Super 用户传入其他 username 会直接返回错误；该规则保留在 Service 层，避免数据层拼错权限。
   */
  public PageResult<Map<String, Object>> getList(
      Integer currentPage, Integer pageSize, String username) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (StringUtils.hasText(username)
        && !isSuper(payload)
        && !username.trim().equals(payload.username())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有权限查看其他用户打卡记录");
    }

    LocalizationQuery query =
        new LocalizationQuery(
            PageRequestParams.normalizePage(currentPage, 1),
            PageRequestParams.normalizePageSize(pageSize, 10),
            username);
    return localizationRepository.findPage(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), query, payload);
  }

  /**
   * 查询打卡详情。
   *
   * <p>旧详情接口未强制鉴权；这里保留兼容策略，有 token 读当前租户库，无 token 读默认租户库。
   */
  public Map<String, Object> getDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    Map<String, Object> detail =
        localizationRepository.findDetail(
            tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate(), id);
    if (detail == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "记录不存在");
    }
    return detail;
  }

  /** 新增当前用户打卡记录；写入 userId 和 username 均来自登录态，避免前端伪造。 */
  public Map<String, Object> create(LocalizationCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (request == null
        || request.punchTime() == null
        || request.status() == null
        || request.longitude() == null
        || request.latitude() == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的参数，包括经纬度");
    }
    return localizationRepository.create(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), request, payload);
  }

  /** 更新打卡定位记录；写接口必须登录并使用当前租户库。 */
  public Map<String, Object> update(int id, LocalizationUpdateRequest request) {
    TenantRequired.currentUser();
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    Map<String, Object> updated =
        localizationRepository.update(
            tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id, request);
    if (updated == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "记录不存在");
    }
    return updated;
  }

  /** 删除打卡定位记录；旧接口是物理删除，这里保持相同语义。 */
  public void delete(int id) {
    TenantRequired.currentUser();
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    int deleted =
        localizationRepository.delete(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id);
    if (deleted == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "记录不存在");
    }
  }

  private boolean isSuper(UserTokenPayload payload) {
    return payload.roles() != null && payload.roles().contains("Super");
  }
}
