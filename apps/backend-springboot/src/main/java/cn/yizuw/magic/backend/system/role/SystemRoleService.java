package cn.yizuw.magic.backend.system.role;

import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class SystemRoleService {

  private final SystemRoleRepository systemRoleRepository;
  private final CacheService cacheService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public SystemRoleService(
      SystemRoleRepository systemRoleRepository,
      CacheService cacheService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.systemRoleRepository = systemRoleRepository;
    this.cacheService = cacheService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public Object getRoleList(
      Integer page,
      Integer pageSize,
      String name,
      String remark,
      String status,
      String startTime,
      String endTime) {
    TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    if (hasFilters(page, pageSize, name, remark, status, startTime, endTime)) {
      return systemRoleRepository.findRolePage(
          jdbcTemplate, page, pageSize, name, remark, status, startTime, endTime);
    }
    return systemRoleRepository.findRoleTree(jdbcTemplate);
  }

  public Map<String, Object> getRoleById(int roleId) {
    TenantRequired.currentUser();
    if (roleId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的角色 ID");
    }
    Map<String, Object> role =
        systemRoleRepository.findRoleById(
            tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), roleId);
    if (role == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "角色不存在");
    }
    return role;
  }

  /** 新增系统角色；同步清理当前租户菜单、权限码和用户信息缓存。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createRole(RoleCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer parentRoleId = optionalPositiveInteger(request == null ? null : request.parentId(), "上级角色ID无效");
    List<Integer> menuIds = idListOrEmpty(request == null ? null : request.permissions(), "权限");
    List<Integer> parkIds = idListOrEmpty(request == null ? null : request.parkIds(), "园区");
    if (parkIds.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建角色必须选择所属园区");
    }
    if (parentRoleId != null) {
      systemRoleRepository.assertSystemRoleExists(jdbcTemplate, parentRoleId);
    }
    systemRoleRepository.assertMenusExist(jdbcTemplate, menuIds);
    systemRoleRepository.assertParksExist(jdbcTemplate, parkIds);
    systemRoleRepository.assertPermissionsWithinParent(jdbcTemplate, parentRoleId, menuIds);

    Map<String, Object> created = systemRoleRepository.createRole(jdbcTemplate, request, parentRoleId);
    int roleId = ((Number) created.get("roleId")).intValue();
    if (!menuIds.isEmpty()) {
      systemRoleRepository.syncRoleMenus(jdbcTemplate, roleId, menuIds);
    }
    systemRoleRepository.syncRoleParks(jdbcTemplate, roleId, parkIds);
    evictTenantAuthCaches(payload.customerId());
    return systemRoleRepository.findRoleById(jdbcTemplate, roleId);
  }

  /** 更新系统角色；同步清理当前租户菜单、权限码和用户信息缓存。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateRole(int roleId, RoleUpdateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (roleId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色ID无效");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer parentRoleId = optionalPositiveInteger(request == null ? null : request.parentId(), "上级角色ID无效");
    List<Integer> menuIds = idListOrNull(request == null ? null : request.permissions(), "权限");
    List<Integer> parkIds = idListOrNull(request == null ? null : request.parkIds(), "园区");

    systemRoleRepository.assertSystemRoleExists(jdbcTemplate, roleId);
    if (parentRoleId != null) {
      if (parentRoleId == roleId) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "上级角色不能是当前角色");
      }
      systemRoleRepository.assertSystemRoleExists(jdbcTemplate, parentRoleId);
    }
    if (menuIds != null) {
      systemRoleRepository.assertMenusExist(jdbcTemplate, menuIds);
      systemRoleRepository.assertPermissionsWithinParent(jdbcTemplate, parentRoleId, menuIds);
    }
    if (parkIds != null) {
      systemRoleRepository.assertParksExist(jdbcTemplate, parkIds);
    }

    systemRoleRepository.updateRole(jdbcTemplate, roleId, request, parentRoleId);
    if (menuIds != null) {
      systemRoleRepository.syncRoleMenus(jdbcTemplate, roleId, menuIds);
    }
    if (parkIds != null) {
      systemRoleRepository.syncRoleParks(jdbcTemplate, roleId, parkIds);
    }
    evictTenantAuthCaches(payload.customerId());
    return systemRoleRepository.findRoleById(jdbcTemplate, roleId);
  }

  /** 删除系统角色；显式清理关联，避免依赖不同数据库环境的级联配置。 */
  @Transactional(readOnly = false)
  public void deleteRole(int roleId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (roleId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "id不能为空");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    systemRoleRepository.assertSystemRoleExists(jdbcTemplate, roleId);
    systemRoleRepository.deleteRole(jdbcTemplate, roleId);
    evictTenantAuthCaches(payload.customerId());
  }

  /** 增量添加菜单权限；不创建或改写菜单本身。 */
  @Transactional(readOnly = false)
  public void addPermissions(int roleId, RolePermissionsRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (roleId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "id is required");
    }
    List<Integer> permissions = requiredIdList(request == null ? null : request.permissions(), "permissions");
    List<Integer> batchRoleIds = idListOrNull(request == null ? null : request.batchRoleIds(), "batchRoleIds");
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    systemRoleRepository.assertSystemRoleExists(jdbcTemplate, roleId);
    systemRoleRepository.assertMenusExist(jdbcTemplate, permissions);
    systemRoleRepository.assertAddPermissionsWithinParent(jdbcTemplate, roleId, permissions, batchRoleIds);
    systemRoleRepository.addRoleMenus(jdbcTemplate, roleId, permissions);
    evictTenantAuthCaches(payload.customerId());
  }

  /** 增量移除菜单权限；旧接口使用 role_menu.is_deleted 软删除。 */
  @Transactional(readOnly = false)
  public void removePermissions(int roleId, RolePermissionsRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (roleId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "id is required");
    }
    List<Integer> permissions = requiredIdList(request == null ? null : request.permissions(), "permissions");
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    systemRoleRepository.assertSystemRoleExists(jdbcTemplate, roleId);
    systemRoleRepository.softDeleteRoleMenus(jdbcTemplate, roleId, permissions);
    evictTenantAuthCaches(payload.customerId());
  }

  /** 新增系统角色权限码绑定；同步清理当前租户权限码和用户信息缓存。 */
  @Transactional(readOnly = false)
  public Map<String, Object> bindRoleCode(RoleCodeRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    RoleCodeIds ids = roleCodeIds(request);
    systemRoleRepository.assertSystemRoleExists(jdbcTemplate, ids.roleId());
    systemRoleRepository.assertCodeExists(jdbcTemplate, ids.codeId());
    Map<String, Object> result =
        systemRoleRepository.createRoleCode(jdbcTemplate, ids.roleId(), ids.codeId(), payload.customerId());
    evictTenantAuthCaches(payload.customerId());
    return result;
  }

  /** 删除系统角色权限码绑定；未找到时保持旧接口业务错误。 */
  @Transactional(readOnly = false)
  public Map<String, Object> unbindRoleCode(RoleCodeRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    RoleCodeIds ids = roleCodeIds(request);
    systemRoleRepository.assertSystemRoleExists(jdbcTemplate, ids.roleId());
    Map<String, Object> result = systemRoleRepository.deleteRoleCode(jdbcTemplate, ids.roleId(), ids.codeId());
    evictTenantAuthCaches(payload.customerId());
    return result;
  }

  private void evictTenantAuthCaches(String customerId) {
    if (customerId == null || customerId.isBlank()) {
      return;
    }
    Runnable eviction =
        () -> {
          String tenantPrefix = "tenant:" + customerId + ":";
          cacheService.evictByPrefix(tenantPrefix + "route-menus:");
          cacheService.evictByPrefix(tenantPrefix + "parent-role-menus:");
          cacheService.evictByPrefix(tenantPrefix + "permission-codes:");
          cacheService.evictByPrefix(tenantPrefix + "user-info:");
        };
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              eviction.run();
            }
          });
      return;
    }
    eviction.run();
  }

  private boolean hasFilters(
      Integer page,
      Integer pageSize,
      String name,
      String remark,
      String status,
      String startTime,
      String endTime) {
    return page != null
        || pageSize != null
        || hasText(name)
        || hasText(remark)
        || hasText(status)
        || hasText(startTime)
        || hasText(endTime);
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private RoleCodeIds roleCodeIds(RoleCodeRequest request) {
    Integer roleId = positiveInteger(request == null ? null : request.roleId(), "roleId和codeId不能为空");
    Integer codeId = positiveInteger(request == null ? null : request.codeId(), "roleId和codeId不能为空");
    return new RoleCodeIds(roleId, codeId);
  }

  private Integer positiveInteger(Object value, String message) {
    if (value instanceof Number number && number.intValue() > 0) {
      return number.intValue();
    }
    try {
      int parsed = Integer.parseInt(String.valueOf(value == null ? "" : value).trim());
      if (parsed > 0) {
        return parsed;
      }
    } catch (RuntimeException ignored) {
      // Fall through to old endpoint validation message.
    }
    throw new BusinessException(HttpStatus.BAD_REQUEST, message);
  }

  private Integer optionalPositiveInteger(Object value, String message) {
    if (value == null || String.valueOf(value).isBlank()) {
      return null;
    }
    return positiveInteger(value, message);
  }

  private List<Integer> requiredIdList(List<Object> values, String label) {
    List<Integer> ids = idListOrNull(values, label);
    if (ids == null || ids.isEmpty()) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, label + " are required and should be an array.");
    }
    return ids;
  }

  private List<Integer> idListOrNull(List<Object> values, String label) {
    if (values == null) {
      return null;
    }
    Set<Integer> ids = new LinkedHashSet<>();
    for (Object value : values) {
      ids.add(positiveInteger(value, label + "ID无效"));
    }
    return List.copyOf(ids);
  }

  private List<Integer> idListOrEmpty(List<Object> values, String label) {
    List<Integer> ids = idListOrNull(values, label);
    return ids == null ? List.of() : ids;
  }

  private record RoleCodeIds(int roleId, int codeId) {}
}
