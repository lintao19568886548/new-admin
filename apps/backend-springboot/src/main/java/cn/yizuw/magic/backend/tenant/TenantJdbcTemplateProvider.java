package cn.yizuw.magic.backend.tenant;

import cn.yizuw.magic.backend.security.UserTokenPayload;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class TenantJdbcTemplateProvider {

  private final TenantDataSourceRegistry tenantDataSourceRegistry;

  public TenantJdbcTemplateProvider(TenantDataSourceRegistry tenantDataSourceRegistry) {
    this.tenantDataSourceRegistry = tenantDataSourceRegistry;
  }

  public JdbcTemplate currentTenantJdbcTemplate() {
    UserTokenPayload user = TenantRequired.currentUser();
    return new JdbcTemplate(tenantDataSourceRegistry.getDataSource(user.customerId(), user.dbName()));
  }

  /** 返回当前登录租户库的数据源，供同库写操作创建本地事务。 */
  public DataSource currentTenantDataSource() {
    UserTokenPayload user = TenantRequired.currentUser();
    return tenantDataSourceRegistry.getDataSource(user.customerId(), user.dbName());
  }

  /**
   * 公开接口也需要读取租户业务表：有 token 时读当前租户库，无 token 时读默认租户库。
   */
  public JdbcTemplate currentOrDefaultTenantJdbcTemplate() {
    UserTokenPayload user = TenantContext.get();
    if (user == null || user.customerId() == null) {
      return new JdbcTemplate(tenantDataSourceRegistry.getDataSource(null, null));
    }
    return new JdbcTemplate(tenantDataSourceRegistry.getDataSource(user.customerId(), user.dbName()));
  }
}
