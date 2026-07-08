package cn.yizuw.magic.backend.menu;

import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.Duration;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MenuService {

  private static final Duration MENU_TTL = Duration.ofMinutes(10);

  private final CacheService cacheService;
  private final MenuRepository menuRepository;
  private final MenuTreeBuilder menuTreeBuilder;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public MenuService(
      CacheService cacheService,
      MenuRepository menuRepository,
      MenuTreeBuilder menuTreeBuilder,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.cacheService = cacheService;
    this.menuRepository = menuRepository;
    this.menuTreeBuilder = menuTreeBuilder;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  @SuppressWarnings("unchecked")
  public List<MenuResponse> getCurrentRouteMenus() {
    UserTokenPayload payload = TenantRequired.currentUser();
    String cacheKey =
        "tenant:"
            + payload.customerId()
            + ":route-menus:"
            + payload.id()
            + ":v"
            + payload.tokenVersion();
    return cacheService.getOrLoad(cacheKey, List.class, MENU_TTL, () -> loadCurrentRouteMenus(payload));
  }

  @SuppressWarnings("unchecked")
  public List<MenuResponse> getSystemMenuList() {
    UserTokenPayload payload = TenantRequired.currentUser();
    String cacheKey = "tenant:" + payload.customerId() + ":system-menu-list:v1";
    return cacheService.getOrLoad(cacheKey, List.class, MENU_TTL, this::loadSystemMenuList);
  }

  @SuppressWarnings("unchecked")
  public List<MenuResponse> getMenusByParentRole(Integer parentRoleId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    String cacheKey =
        "tenant:"
            + payload.customerId()
            + ":parent-role-menus:"
            + (parentRoleId == null ? "all" : parentRoleId)
            + ":v"
            + payload.tokenVersion();
    return cacheService.getOrLoad(
        cacheKey, List.class, MENU_TTL, () -> loadMenusByParentRole(parentRoleId));
  }

  public boolean isMenuNameExists(String name, Integer excludeMenuId) {
    TenantRequired.currentUser();
    return menuRepository.existsByName(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), name, excludeMenuId);
  }

  public boolean isMenuPathExists(String path, Integer excludeMenuId) {
    TenantRequired.currentUser();
    return menuRepository.existsByPath(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), path, excludeMenuId);
  }

  /** 新增系统菜单和 meta；button 类型菜单同步创建权限码，并清理菜单缓存。 */
  @Transactional
  public MenuResponse createSystemMenu(MenuUpdateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    MenuRow row =
        menuRepository.createMenu(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), request);
    evictMenuCaches(payload.customerId());
    return menuTreeBuilder
        .buildTree(List.of(row), new MenuTreeBuilder.MenuTreeOptions(true, true, true))
        .get(0);
  }

  /** 更新系统菜单和 meta；同步模板字段到权限码，并清理菜单相关缓存。 */
  @Transactional
  public MenuResponse updateSystemMenu(int menuId, MenuUpdateRequest request) {
    if (menuId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "menuId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    MenuRow row =
        menuRepository.updateMenu(
            tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), menuId, request);
    evictMenuCaches(payload.customerId());
    return menuTreeBuilder
        .buildTree(List.of(row), new MenuTreeBuilder.MenuTreeOptions(true, true, true))
        .get(0);
  }

  /** 删除系统菜单；button 类型菜单删除时同步删除对应权限码。 */
  @Transactional
  public void deleteSystemMenu(int menuId) {
    if (menuId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "menuId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    menuRepository.deleteMenu(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), menuId);
    evictMenuCaches(payload.customerId());
  }

  private List<MenuResponse> loadCurrentRouteMenus(UserTokenPayload payload) {
    var jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<String> roleNames = menuRepository.findRoleNamesByUserId(jdbcTemplate, payload.id());
    List<MenuRow> rows =
        menuRepository.findRouteMenusForRoleNames(jdbcTemplate, roleNames);
    return menuTreeBuilder.buildTree(rows, new MenuTreeBuilder.MenuTreeOptions(false, true, true));
  }

  private List<MenuResponse> loadSystemMenuList() {
    List<MenuRow> rows =
        menuRepository.findAllMenus(tenantJdbcTemplateProvider.currentTenantJdbcTemplate());
    return menuTreeBuilder.buildTree(rows, new MenuTreeBuilder.MenuTreeOptions(true, true, true));
  }

  private List<MenuResponse> loadMenusByParentRole(Integer parentRoleId) {
    List<MenuRow> rows =
        menuRepository.findMenusForParentRole(
            tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), parentRoleId);
    return menuTreeBuilder.buildTree(rows, new MenuTreeBuilder.MenuTreeOptions(true, true, true));
  }

  private void evictMenuCaches(String customerId) {
    cacheService.evictByPrefix("tenant:" + customerId + ":route-menus:");
    cacheService.evictByPrefix("tenant:" + customerId + ":system-menu-list:");
    cacheService.evictByPrefix("tenant:" + customerId + ":parent-role-menus:");
    cacheService.evictByPrefix("tenant:" + customerId + ":permission-codes:");
  }
}
