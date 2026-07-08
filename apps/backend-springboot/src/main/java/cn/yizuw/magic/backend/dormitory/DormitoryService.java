package cn.yizuw.magic.backend.dormitory;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 宿舍写接口服务层，统一处理登录态、租户库选择和园区权限边界。 */
@Service
@Transactional(readOnly = true)
public class DormitoryService {

  private final DormitoryRepository dormitoryRepository;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public DormitoryService(
      DormitoryRepository dormitoryRepository,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.dormitoryRepository = dormitoryRepository;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** 新增宿舍主表；调用方必须具备目标园区操作权限，不写 dormitory_image。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createDormitory(DormitoryCreateRequest request) {
    DormitoryContext context = dormitoryContext();
    return dormitoryRepository.createDormitory(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新宿舍主表；调用方必须具备原园区和目标园区操作权限。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateDormitory(int id, DormitoryUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的宿舍ID");
    }
    DormitoryContext context = dormitoryContext();
    return dormitoryRepository.updateDormitory(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除宿舍；先删除 dormitory_image 关系，再物理删除宿舍主表。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteDormitory(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的宿舍ID");
    }
    DormitoryContext context = dormitoryContext();
    return dormitoryRepository.deleteDormitory(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  private DormitoryContext dormitoryContext() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return new DormitoryContext(jdbcTemplate, authorizedParkIds);
  }

  private record DormitoryContext(JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {}
}
