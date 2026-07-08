package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 执行组织成员用户范围业务数据迁移；调用方负责租约校验、目标库确认和灰度开关。 */
public interface OrganizationProvisioningUserScopedDataMigrationClient {

  UserScopedDataMigrationResult migrateUserScopedData(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      String targetCustomerId,
      List<UserScopedDataMigrationCommand> members,
      IntSupplier heartbeatAfterEachCopiedChunk);

  /** 单个组织成员迁移用户范围业务数据所需的中心库资料。 */
  record UserScopedDataMigrationCommand(
      long centerUserId, String centerUsername, String centerPhone, Long sourceUserId) {}

  /** 单张表的复制摘要；rowsCopied 为源表匹配并写入目标库的行数。 */
  record TableCopySummary(String tableName, long rowsCopied, long chunksCopied) {}

  /** 单个成员的用户范围业务数据迁移摘要。 */
  record UserScopedDataMigrationItem(
      long centerUserId,
      Long sourceUserId,
      String sourceUsername,
      long targetUserId,
      long totalRowsCopied,
      long copiedChunks,
      List<TableCopySummary> tableCopies) {}

  /** 本批用户范围业务数据迁移执行结果。 */
  record UserScopedDataMigrationResult(
      List<UserScopedDataMigrationItem> members,
      List<TableCopySummary> tableCopies,
      long migratedMemberCount) {

    public long totalRowsCopied() {
      return tableCopies.stream().mapToLong(TableCopySummary::rowsCopied).sum();
    }

    public long copiedChunks() {
      return tableCopies.stream().mapToLong(TableCopySummary::chunksCopied).sum();
    }

    public List<String> copiedTables() {
      return tableCopies.stream()
          .map(TableCopySummary::tableName)
          .filter(tableName -> tableName != null && !tableName.isBlank())
          .distinct()
          .toList();
    }
  }
}
