package cn.yizuw.magic.backend.tenant;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

class TenantDataSourceRegistryTest {

  @Test
  void resolveTenantJdbcUrlReplacesDatabaseNameForNativeJdbcUrls() throws Exception {
    AppProperties appProperties = new AppProperties();
    TenantDataSourceProperties properties = new TenantDataSourceProperties();
    properties.setDefaultJdbcUrl(
        "jdbc:mysql://localhost:3306/default_db?serverTimezone=Asia%2FShanghai");
    TenantDataSourceRegistry registry = new TenantDataSourceRegistry(appProperties, properties);

    assertThat(resolveTenantJdbcUrl(registry, "acme", null))
        .isEqualTo("jdbc:mysql://localhost:3306/customer_acme?serverTimezone=Asia%2FShanghai");
    assertThat(resolveTenantJdbcUrl(registry, "acme", "tenant_override"))
        .isEqualTo("jdbc:mysql://localhost:3306/tenant_override?serverTimezone=Asia%2FShanghai");
  }

  private String resolveTenantJdbcUrl(
      TenantDataSourceRegistry registry, String customerId, String dbName) throws Exception {
    Method method =
        TenantDataSourceRegistry.class.getDeclaredMethod(
            "resolveTenantJdbcUrl", String.class, String.class);
    method.setAccessible(true);
    return (String) method.invoke(registry, customerId, dbName);
  }
}
