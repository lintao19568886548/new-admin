package cn.yizuw.magic.backend.job;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.function.IntSupplier;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** JDBC 版中心库角色快照写入；对齐旧 worker 的先删后插事务语义。 */
@Component
public class JdbcOrganizationProvisioningRoleSnapshotCenterWriteClient
    implements OrganizationProvisioningRoleSnapshotCenterWriteClient {

  private final JdbcTemplate centerJdbcTemplate;
  private final TransactionTemplate transactionTemplate;

  public JdbcOrganizationProvisioningRoleSnapshotCenterWriteClient(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    DataSource dataSource = centerJdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("中心库数据源不可用，无法写入组织开通角色快照");
    }
    this.transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
  }

  @Override
  public RoleSnapshotCenterWriteResult writeRoleSnapshots(
      long jobId,
      long sourceOrgId,
      List<RoleSnapshotCenterWriteCommand> snapshots,
      IntSupplier heartbeatAfterCenterWrite) {
    RoleSnapshotCenterWriteResult result =
        transactionTemplate.execute(
            ignored -> {
              RoleSnapshotCenterWriteResult writeResult =
                  writeRoleSnapshotsInTransaction(jobId, sourceOrgId, snapshots);
              heartbeatAfterCenterWrite.getAsInt();
              return writeResult;
            });
    if (result == null) {
      throw new IllegalStateException("中心库角色快照写入事务未返回结果");
    }
    return result;
  }

  private RoleSnapshotCenterWriteResult writeRoleSnapshotsInTransaction(
      long jobId, long sourceOrgId, List<RoleSnapshotCenterWriteCommand> snapshots) {
    if (jobId <= 0) {
      throw new IllegalArgumentException("写入中心库角色快照缺少 jobId");
    }
    if (sourceOrgId <= 0) {
      throw new IllegalArgumentException("写入中心库角色快照缺少 sourceOrgId");
    }
    List<RoleSnapshotCenterWriteCommand> normalizedSnapshots =
        snapshots == null ? List.of() : List.copyOf(snapshots);
    for (RoleSnapshotCenterWriteCommand snapshot : normalizedSnapshots) {
      if (snapshot.sourceRoleId() <= 0 || snapshot.targetRoleId() <= 0) {
        throw new IllegalArgumentException(
            "中心库角色快照包含非法 roleId: sourceRoleId="
                + snapshot.sourceRoleId()
                + ", targetRoleId="
                + snapshot.targetRoleId());
      }
    }

    long deletedRows =
        centerJdbcTemplate.update(
            "DELETE FROM tenant_provisioning_role_snapshot WHERE job_id = ?", jobId);
    Instant now = Instant.now();
    Timestamp timestamp = Timestamp.from(now);
    long insertedRows = 0L;
    for (RoleSnapshotCenterWriteCommand snapshot : normalizedSnapshots) {
      insertedRows +=
          centerJdbcTemplate.update(
              """
              INSERT INTO tenant_provisioning_role_snapshot
                (job_id, source_org_id, source_role_id, target_role_id, role_name, create_time, update_time)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              """,
              jobId,
              sourceOrgId,
              snapshot.sourceRoleId(),
              snapshot.targetRoleId(),
              snapshot.roleName(),
              timestamp,
              timestamp);
    }
    return new RoleSnapshotCenterWriteResult(
        deletedRows, insertedRows, jobId, sourceOrgId, normalizedSnapshots);
  }
}
