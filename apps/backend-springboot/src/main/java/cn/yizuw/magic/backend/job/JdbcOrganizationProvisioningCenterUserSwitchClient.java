package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntSupplier;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** JDBC 版中心用户租户切换；只写中心库 customer/user_tenant_mapping/user/refresh_token/organization_tenant_mapping。 */
@Component
public class JdbcOrganizationProvisioningCenterUserSwitchClient
    implements OrganizationProvisioningCenterUserSwitchClient {

  private final JdbcTemplate centerJdbcTemplate;
  private final TransactionTemplate transactionTemplate;

  public JdbcOrganizationProvisioningCenterUserSwitchClient(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    DataSource dataSource = centerJdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("中心库数据源不可用，无法切换中心用户租户归属");
    }
    this.transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
  }

  @Override
  public CenterUserSwitchResult switchCenterUsersToTarget(
      String targetJdbcUrl,
      CenterUserSwitchCommand command,
      IntSupplier heartbeatAfterCenterSwitch) {
    assertCommand(command);
    if (heartbeatAfterCenterSwitch == null) {
      throw new IllegalArgumentException("中心用户切换缺少 heartbeat 回调");
    }
    JdbcTemplate targetJdbcTemplate =
        new JdbcTemplate(dataSource(required(targetJdbcUrl, "中心用户切换缺少 targetJdbcUrl")));
    List<ResolvedMember> resolvedMembers = resolveTargetUsers(targetJdbcTemplate, command.members());
    CenterUserSwitchResult result =
        transactionTemplate.execute(
            ignored -> switchCenterUsersInTransaction(command, resolvedMembers, heartbeatAfterCenterSwitch));
    if (result == null) {
      throw new IllegalStateException("中心用户租户切换事务未返回结果");
    }
    return result;
  }

  private CenterUserSwitchResult switchCenterUsersInTransaction(
      CenterUserSwitchCommand command,
      List<ResolvedMember> resolvedMembers,
      IntSupplier heartbeatAfterCenterSwitch) {
    assertLease(command);
    int customerRows = upsertCustomer(command);
    List<CenterUserSwitchMemberResult> memberResults = new ArrayList<>();
    for (ResolvedMember member : resolvedMembers) {
      assertTargetUserMappingAvailable(command, member);
      int mappingRows = upsertUserTenantMapping(command, member);
      String previousCustomerType = centerUserCustomerType(member.centerUserId());
      boolean switched = !command.targetCustomerId().equals(string(previousCustomerType));
      int revokedRows = 0;
      if (switched) {
        updateCenterUserCustomerType(command, member.centerUserId());
        revokedRows = revokeRefreshTokens(member.centerUserId());
      }
      memberResults.add(
          new CenterUserSwitchMemberResult(
              member.centerUserId(),
              member.centerUsername(),
              member.targetUserId(),
              previousCustomerType,
              switched,
              mappingRows,
              revokedRows));
    }
    int organizationMappingRows = upsertOrganizationTenantMapping(command);
    heartbeatAfterCenterSwitch.getAsInt();
    return new CenterUserSwitchResult(
        command.jobId(),
        command.targetCustomerId(),
        command.targetDbName(),
        customerRows,
        organizationMappingRows,
        List.copyOf(memberResults));
  }

  private List<ResolvedMember> resolveTargetUsers(
      JdbcTemplate targetJdbcTemplate, List<CenterUserSwitchMemberCommand> members) {
    List<ResolvedMember> resolvedMembers = new ArrayList<>();
    for (CenterUserSwitchMemberCommand member : members) {
      String username =
          required(member.centerUsername(), "组织成员中心用户名为空: centerUserId=" + member.centerUserId());
      List<Long> targetUserIds =
          targetJdbcTemplate.query(
              "SELECT id FROM `user` WHERE username = ? LIMIT 1",
              (rs, rowNum) -> rs.getLong("id"),
              username);
      if (targetUserIds.isEmpty() || targetUserIds.get(0) == null || targetUserIds.get(0) <= 0) {
        throw new IllegalStateException(
            "目标租户用户缺失，无法切换中心用户: centerUserId=" + member.centerUserId());
      }
      resolvedMembers.add(
          new ResolvedMember(member.centerUserId(), username, targetUserIds.get(0)));
    }
    return resolvedMembers;
  }

  private void assertCommand(CenterUserSwitchCommand command) {
    if (command == null) {
      throw new IllegalArgumentException("中心用户切换命令为空");
    }
    if (command.jobId() <= 0) {
      throw new IllegalArgumentException("中心用户切换缺少 jobId");
    }
    if (!StringUtils.hasText(command.lockOwner())) {
      throw new IllegalArgumentException("中心用户切换缺少 lockOwner");
    }
    if (command.sourceOrgId() <= 0) {
      throw new IllegalArgumentException("中心用户切换缺少 sourceOrgId");
    }
    required(command.sourceCustomerId(), "中心用户切换缺少 sourceCustomerId");
    required(command.targetCustomerId(), "中心用户切换缺少 targetCustomerId");
    required(command.targetDbName(), "中心用户切换缺少 targetDbName");
    required(command.customerName(), "中心用户切换缺少 customerName");
    if (command.members() == null || command.members().isEmpty()) {
      throw new IllegalArgumentException("中心用户切换缺少组织成员");
    }
    for (CenterUserSwitchMemberCommand member : command.members()) {
      if (member == null) {
        throw new IllegalArgumentException("中心用户切换成员命令为空");
      }
      if (member.centerUserId() <= 0) {
        throw new IllegalArgumentException("中心用户切换成员缺少 centerUserId");
      }
      required(member.centerUsername(), "中心用户切换成员缺少 centerUsername");
    }
  }

  private void assertLease(CenterUserSwitchCommand command) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
            """,
            Long.class,
            command.jobId(),
            command.lockOwner());
    if (count == null || count <= 0) {
      throw new IllegalStateException("租户开通任务租约已失效，无法切换租户 jobId=" + command.jobId());
    }
  }

  private int upsertCustomer(CenterUserSwitchCommand command) {
    int updatedRows =
        centerJdbcTemplate.update(
            """
            UPDATE customer
            SET city = ?,
                company_short_name = ?,
                db_name = ?,
                name = ?,
                status = 1,
                update_time = NOW()
            WHERE customer_id = ?
            """,
            blankToNull(command.targetCity()),
            blankToNull(command.targetCompanyShortName()),
            command.targetDbName(),
            command.customerName(),
            command.targetCustomerId());
    if (updatedRows > 0) {
      return updatedRows;
    }
    return centerJdbcTemplate.update(
        """
        INSERT INTO customer (
          customer_id, code, city, company_short_name, db_name, name, status, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, ?, ?, 1, NOW(), NOW()
        )
        """,
        command.targetCustomerId(),
        command.targetCustomerId(),
        blankToNull(command.targetCity()),
        blankToNull(command.targetCompanyShortName()),
        command.targetDbName(),
        command.customerName());
  }

  private void assertTargetUserMappingAvailable(CenterUserSwitchCommand command, ResolvedMember member) {
    List<Long> mappedCenterUserIds =
        centerJdbcTemplate.queryForList(
            """
            SELECT center_user_id
            FROM user_tenant_mapping
            WHERE customer_id = ?
              AND customer_user_id = ?
            LIMIT 1
            """,
            Long.class,
            command.targetCustomerId(),
            member.targetUserId());
    if (!mappedCenterUserIds.isEmpty()
        && mappedCenterUserIds.get(0) != null
        && mappedCenterUserIds.get(0) != member.centerUserId()) {
      throw new IllegalStateException(
          "目标租户用户已绑定其他中心用户，无法切换: targetUserId=" + member.targetUserId());
    }
  }

  private int upsertUserTenantMapping(CenterUserSwitchCommand command, ResolvedMember member) {
    return centerJdbcTemplate.update(
        """
        INSERT INTO user_tenant_mapping (
          center_user_id, customer_id, customer_user_id, db_name, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          customer_user_id = VALUES(customer_user_id),
          db_name = VALUES(db_name),
          update_time = NOW()
        """,
        member.centerUserId(),
        command.targetCustomerId(),
        member.targetUserId(),
        command.targetDbName());
  }

  private String centerUserCustomerType(long centerUserId) {
    List<String> rows =
        centerJdbcTemplate.query(
            "SELECT customer_type FROM `user` WHERE id = ? LIMIT 1",
            (rs, rowNum) -> rs.getString("customer_type"),
            centerUserId);
    if (rows.isEmpty()) {
      throw new IllegalStateException("中心用户不存在，无法切换租户: " + centerUserId);
    }
    return rows.get(0);
  }

  private void updateCenterUserCustomerType(CenterUserSwitchCommand command, long centerUserId) {
    String previousCustomerType = centerUserCustomerType(centerUserId);
    if (StringUtils.hasText(previousCustomerType)
        && !previousCustomerType.equals(command.sourceCustomerId())
        && !previousCustomerType.equals(command.targetCustomerId())) {
      throw new IllegalStateException(
          "中心用户已归属到其他租户: centerUserId="
              + centerUserId
              + ", customerType="
              + previousCustomerType
              + "，停止自动切换");
    }
    centerJdbcTemplate.update(
        """
        UPDATE `user`
        SET customer_type = ?,
            token_version = token_version + 1,
            update_time = NOW()
        WHERE id = ?
        """,
        command.targetCustomerId(),
        centerUserId);
  }

  private int revokeRefreshTokens(long centerUserId) {
    return centerJdbcTemplate.update(
        """
        UPDATE refresh_token
        SET revoked_at = NOW(),
            update_time = NOW()
        WHERE user_id = ?
          AND revoked_at IS NULL
        """,
        centerUserId);
  }

  private int upsertOrganizationTenantMapping(CenterUserSwitchCommand command) {
    return centerJdbcTemplate.update(
        """
        INSERT INTO organization_tenant_mapping (
          organization_id, target_customer_id, target_db_name, tenant_provisioning_job_id,
          status, legacy, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, 'active', false, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          status = 'active',
          target_db_name = VALUES(target_db_name),
          tenant_provisioning_job_id = VALUES(tenant_provisioning_job_id),
          update_time = NOW()
        """,
        command.sourceOrgId(),
        command.targetCustomerId(),
        command.targetDbName(),
        command.jobId());
  }

  private DriverManagerDataSource dataSource(String jdbcUrl) {
    DatabaseUrl parsed = DatabaseUrl.parse(jdbcUrl);
    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
    dataSource.setUrl(parsed.jdbcUrl());
    if (StringUtils.hasText(parsed.username())) {
      dataSource.setUsername(parsed.username());
    }
    if (parsed.password() != null) {
      dataSource.setPassword(parsed.password());
    }
    return dataSource;
  }

  private String required(String value, String message) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException(message);
    }
    return value.trim();
  }

  private String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private String string(String value) {
    return value == null ? "" : value;
  }

  private record ResolvedMember(long centerUserId, String centerUsername, long targetUserId) {}
}
