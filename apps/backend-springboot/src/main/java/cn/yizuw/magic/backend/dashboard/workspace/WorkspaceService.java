package cn.yizuw.magic.backend.dashboard.workspace;

import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 工作台业务层，负责鉴权和分页参数默认值处理。 */
@Service
@Transactional(readOnly = true)
public class WorkspaceService {

  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;
  private final WorkspaceRepository workspaceRepository;

  public WorkspaceService(
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider,
      WorkspaceRepository workspaceRepository) {
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
    this.workspaceRepository = workspaceRepository;
  }

  /** 查询访问日志分页数据，高级角色看全局，普通用户看本角色及子角色人员。 */
  public PageResult<Map<String, Object>> getList(
      Integer currentPage, String endTime, Integer pageSize, String startTime) {
    UserTokenPayload payload = TenantRequired.currentUser();
    WorkspaceQuery query =
        new WorkspaceQuery(
            PageRequestParams.normalizePage(currentPage, 1),
            endTime,
            PageRequestParams.normalizePageSize(pageSize, 20),
            startTime);
    return workspaceRepository.findPage(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), query, payload);
  }
}
