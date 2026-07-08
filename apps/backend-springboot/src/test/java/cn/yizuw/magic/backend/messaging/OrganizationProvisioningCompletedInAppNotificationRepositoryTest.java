package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/** in_app_notification 仓储测试；不连接真实数据库。 */
class OrganizationProvisioningCompletedInAppNotificationRepositoryTest {

  @Test
  void insertRowsWritesAllRows() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    OrganizationProvisioningCompletedInAppNotificationRepository repository =
        new OrganizationProvisioningCompletedInAppNotificationRepository(jdbcTemplate);

    OrganizationProvisioningCompletedInAppNotificationRepositoryResult result =
        repository.insertRows(List.of(row("1001"), row("1002")));

    assertThat(result.requestedRows()).isEqualTo(2);
    assertThat(result.insertedRows()).isEqualTo(2);
    assertThat(result.duplicateRows()).isZero();
    assertThat(jdbcTemplate.insertCalls).isEqualTo(2);
    assertThat(jdbcTemplate.lastArgs)
        .containsExactly(
            "evt_notification_31:in_app",
            "organization-provisioning-completed-provider:31:in_app:1002",
            1002L,
            "org001",
            "tenant_org001",
            OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
            "组织空间开通完成",
            "您的组织空间已开通完成，请刷新后进入新空间。",
            "unread",
            "{\"jobId\":31}");
  }

  @Test
  void insertRowsCountsDuplicateKeys() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    jdbcTemplate.duplicateOnSecondInsert = true;
    OrganizationProvisioningCompletedInAppNotificationRepository repository =
        new OrganizationProvisioningCompletedInAppNotificationRepository(jdbcTemplate);

    OrganizationProvisioningCompletedInAppNotificationRepositoryResult result =
        repository.insertRows(List.of(row("1001"), row("1002")));

    assertThat(result.requestedRows()).isEqualTo(2);
    assertThat(result.insertedRows()).isEqualTo(1);
    assertThat(result.duplicateRows()).isEqualTo(1);
    assertThat(jdbcTemplate.insertCalls).isEqualTo(2);
  }

  private OrganizationProvisioningCompletedInAppNotificationInsertRow row(String userId) {
    return new OrganizationProvisioningCompletedInAppNotificationInsertRow(
        "evt_notification_31:in_app",
        "organization-provisioning-completed-provider:31:in_app:" + userId,
        Long.parseLong(userId),
        "org001",
        "tenant_org001",
        OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY,
        "组织空间开通完成",
        "您的组织空间已开通完成，请刷新后进入新空间。",
        "unread",
        "{\"jobId\":31}");
  }

  private static final class CapturingJdbcTemplate extends JdbcTemplate {
    boolean duplicateOnSecondInsert;
    int insertCalls;
    Object[] lastArgs;

    @Override
    public int update(String sql, Object... args) {
      insertCalls++;
      lastArgs = args;
      if (duplicateOnSecondInsert && insertCalls == 2) {
        throw new DuplicateKeyException("duplicate in_app_notification");
      }
      return 1;
    }
  }
}
