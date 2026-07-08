package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.IntSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** JDBC 版用户范围业务数据迁移；按旧 worker 的分页复制和列交集策略写目标租户库。 */
@Component
public class JdbcOrganizationProvisioningUserScopedDataMigrationClient
    implements OrganizationProvisioningUserScopedDataMigrationClient {

  private static final int COPY_CHUNK_SIZE = 100;
  private static final int COPY_PAGE_SIZE = 500;

  @Override
  public UserScopedDataMigrationResult migrateUserScopedData(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      String targetCustomerId,
      List<UserScopedDataMigrationCommand> members,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    DriverManagerDataSource targetDataSource = dataSource(targetJdbcUrl);
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(targetDataSource);
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(targetDataSource));

    UserScopedDataMigrationResult result =
        transactionTemplate.execute(
            ignored ->
                migrateMembersInTargetTransaction(
                    sourceJdbcTemplate,
                    targetJdbcTemplate,
                    targetCustomerId,
                    members,
                    heartbeatAfterEachCopiedChunk));
    if (result == null) {
      throw new IllegalStateException("组织成员用户范围数据迁移事务未返回结果");
    }
    return result;
  }

  private UserScopedDataMigrationResult migrateMembersInTargetTransaction(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String targetCustomerId,
      List<UserScopedDataMigrationCommand> members,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    List<UserScopedDataMigrationItem> items = new ArrayList<>();
    CopySummaryAccumulator totalCopies = new CopySummaryAccumulator();

    for (UserScopedDataMigrationCommand member : members) {
      UserScopedContext context =
          resolveUserScopedContext(
              sourceJdbcTemplate, targetJdbcTemplate, targetCustomerId, member);
      CopySummaryAccumulator memberCopies = new CopySummaryAccumulator();
      copyMemberUserScopedData(
          sourceJdbcTemplate,
          targetJdbcTemplate,
          context,
          memberCopies,
          totalCopies,
          heartbeatAfterEachCopiedChunk);
      items.add(
          new UserScopedDataMigrationItem(
              context.centerUserId(),
              context.sourceUserId(),
              context.sourceUsername(),
              context.targetUserId(),
              memberCopies.totalRowsCopied(),
              memberCopies.copiedChunks(),
              memberCopies.summaries()));
    }

    return new UserScopedDataMigrationResult(
        List.copyOf(items), totalCopies.summaries(), items.size());
  }

  private UserScopedContext resolveUserScopedContext(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String targetCustomerId,
      UserScopedDataMigrationCommand member) {
    SourceUserRow sourceUser = findSourceUser(sourceJdbcTemplate, member);
    String targetUsername =
        required(member.centerUsername(), "组织成员中心用户名为空: centerUserId=" + member.centerUserId());
    List<Long> targetUserIds =
        targetJdbcTemplate.query(
            "SELECT id FROM `user` WHERE username = ? LIMIT 1",
            (rs, rowNum) -> rs.getLong("id"),
            targetUsername);
    if (targetUserIds.isEmpty() || targetUserIds.get(0) <= 0) {
      throw new IllegalStateException(
          "目标租户用户未创建，不能迁移用户范围数据: centerUserId=" + member.centerUserId());
    }
    return new UserScopedContext(
        member.centerUserId(),
        firstText(sourceUser.username(), targetUsername),
        sourceUser.id(),
        targetCustomerId,
        targetUserIds.get(0),
        member.centerPhone());
  }

  private SourceUserRow findSourceUser(
      JdbcTemplate sourceJdbcTemplate, UserScopedDataMigrationCommand member) {
    List<SourceUserRow> rows =
        member.sourceUserId() == null
            ? sourceJdbcTemplate.query(
                """
                SELECT id, username
                FROM `user`
                WHERE username = ?
                LIMIT 1
                """,
                (rs, rowNum) -> sourceUser(rs),
                required(
                    member.centerUsername(),
                    "组织成员缺少 sourceUserId 且中心用户名为空: centerUserId=" + member.centerUserId()))
            : sourceJdbcTemplate.query(
                """
                SELECT id, username
                FROM `user`
                WHERE id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> sourceUser(rs),
                member.sourceUserId());
    if (rows.isEmpty()) {
      throw new IllegalStateException("未找到组织成员源租户用户: centerUserId=" + member.centerUserId());
    }
    return rows.get(0);
  }

  private SourceUserRow sourceUser(ResultSet rs) throws SQLException {
    return new SourceUserRow(rs.getLong("id"), rs.getString("username"));
  }

  private void copyMemberUserScopedData(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      UserScopedContext context,
      CopySummaryAccumulator memberCopies,
      CopySummaryAccumulator totalCopies,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    Map<String, ColumnTransform> transforms = userIdTransforms(context);
    PageCallback copyParks =
        rows ->
            addSummary(
                copyParksForPage(
                    sourceJdbcTemplate,
                    targetJdbcTemplate,
                    rows,
                    heartbeatAfterEachCopiedChunk),
                memberCopies,
                totalCopies);

    addSummary(
        copyRowsByCursor(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "localization",
            "localization_id",
            "WHERE user_id = ? OR user_name = ?",
            List.of(context.sourceUserId(), context.sourceUsername()),
            transforms,
            null,
            null,
            heartbeatAfterEachCopiedChunk),
        memberCopies,
        totalCopies);
    addSummary(
        copyRowsByCursor(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "attendances",
            "attendanceId",
            "WHERE user_id = ? OR username = ?",
            List.of(context.sourceUserId(), context.sourceUsername()),
            transforms,
            null,
            null,
            heartbeatAfterEachCopiedChunk),
        memberCopies,
        totalCopies);
    addSummary(
        copyRowsByCursor(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "feedback",
            "id",
            "WHERE user_id = ? OR center_user_id = ? OR username = ?",
            List.of(context.sourceUserId(), context.centerUserId(), context.sourceUsername()),
            transforms,
            null,
            null,
            heartbeatAfterEachCopiedChunk),
        memberCopies,
        totalCopies);
    addSummary(
        copyRowsByCursor(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "leave_application",
            "id",
            "WHERE user_id = ? OR username = ? OR user = ?",
            List.of(context.sourceUserId(), context.sourceUsername(), context.sourceUsername()),
            transforms,
            copyParks,
            null,
            heartbeatAfterEachCopiedChunk),
        memberCopies,
        totalCopies);
    addSummary(
        copyRowsByCursor(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "reimbursement",
            "id",
            "WHERE user_id = ? OR username = ?",
            List.of(context.sourceUserId(), context.sourceUsername()),
            transforms,
            copyParks,
            rows ->
                addSummary(
                    copyImagesForOwnerPage(
                        sourceJdbcTemplate,
                        targetJdbcTemplate,
                        "reimbursement_image",
                        "reimbursement_id",
                        "id",
                        rows,
                        memberCopies,
                        totalCopies,
                        heartbeatAfterEachCopiedChunk),
                    memberCopies,
                    totalCopies),
            heartbeatAfterEachCopiedChunk),
        memberCopies,
        totalCopies);

    List<String> investmentPhones = investmentPhones(context);
    if (!investmentPhones.isEmpty()) {
      addSummary(
          copyRowsByCursor(
              sourceJdbcTemplate,
              targetJdbcTemplate,
              "investment",
              "investment_id",
              "WHERE phone_number IN (" + placeholders(investmentPhones.size()) + ")",
              investmentPhones,
              Map.of(),
              copyParks,
              rows ->
                  addSummary(
                      copyImagesForOwnerPage(
                          sourceJdbcTemplate,
                          targetJdbcTemplate,
                          "investment_image",
                          "investment_id",
                          "investment_id",
                          rows,
                          memberCopies,
                          totalCopies,
                          heartbeatAfterEachCopiedChunk),
                      memberCopies,
                      totalCopies),
              heartbeatAfterEachCopiedChunk),
          memberCopies,
          totalCopies);
    }
  }

  private Map<String, ColumnTransform> userIdTransforms(UserScopedContext context) {
    return Map.of(
        "audit_user_id",
        (value, row) -> numberEquals(value, context.sourceUserId()) ? context.targetUserId() : null,
        "center_user_id",
        (value, row) -> context.centerUserId(),
        "customer_id",
        (value, row) -> context.targetCustomerId(),
        "user_id",
        (value, row) -> context.targetUserId());
  }

  private TableCopySummary copyParksForPage(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      List<Map<String, Object>> rows,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    return copyRowsByIds(
        sourceJdbcTemplate,
        targetJdbcTemplate,
        "park",
        "park_id",
        pickPositiveIds(rows, "park_id"),
        Map.of(),
        heartbeatAfterEachCopiedChunk);
  }

  private TableCopySummary copyImagesForOwnerPage(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String linkTableName,
      String linkOwnerColumn,
      String ownerIdColumn,
      List<Map<String, Object>> rows,
      CopySummaryAccumulator memberCopies,
      CopySummaryAccumulator totalCopies,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    List<Long> ownerIds = pickPositiveIds(rows, ownerIdColumn);
    if (ownerIds.isEmpty()) {
      return new TableCopySummary(linkTableName, 0, 0);
    }
    return copyRowsByCursor(
        sourceJdbcTemplate,
        targetJdbcTemplate,
        linkTableName,
        "id",
        "WHERE " + quoteIdentifier(linkOwnerColumn) + " IN (" + placeholders(ownerIds.size()) + ")",
        ownerIds,
        Map.of(),
        imageRows ->
            addSummary(
                copyRowsByIds(
                    sourceJdbcTemplate,
                    targetJdbcTemplate,
                    "image",
                    "img_id",
                    pickPositiveIds(imageRows, "img_id"),
                    Map.of(),
                    heartbeatAfterEachCopiedChunk),
                memberCopies,
                totalCopies),
        null,
        heartbeatAfterEachCopiedChunk);
  }

  private TableCopySummary copyRowsByIds(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      String idColumn,
      List<Long> ids,
      Map<String, ColumnTransform> targetTransforms,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    List<Long> normalizedIds = uniquePositiveNumbers(ids);
    if (normalizedIds.isEmpty()) {
      return new TableCopySummary(tableName, 0, 0);
    }
    return copyRows(
        sourceJdbcTemplate,
        targetJdbcTemplate,
        tableName,
        "WHERE " + quoteIdentifier(idColumn) + " IN (" + placeholders(normalizedIds.size()) + ")",
        normalizedIds,
        targetTransforms,
        heartbeatAfterEachCopiedChunk);
  }

  private TableCopySummary copyRowsByCursor(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      String cursorColumn,
      String whereSql,
      List<?> params,
      Map<String, ColumnTransform> targetTransforms,
      PageCallback beforeWritePage,
      PageCallback afterWritePage,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    PreparedCopyRowsPlan plan = prepareCopyRowsPlan(sourceJdbcTemplate, targetJdbcTemplate, tableName);
    if (plan.columns().isEmpty()) {
      return new TableCopySummary(tableName, 0, 0);
    }
    if (!plan.columns().contains(cursorColumn)) {
      throw new IllegalStateException(tableName + " 缺少游标列 " + cursorColumn + "，无法分页迁移");
    }

    String normalizedWhereSql = normalizeWhereClause(whereSql);
    Object cursorValue = null;
    long rowsCopied = 0L;
    long chunksCopied = 0L;
    while (true) {
      List<String> whereClauses = new ArrayList<>();
      List<Object> queryParams = new ArrayList<>(params);
      if (StringUtils.hasText(normalizedWhereSql)) {
        whereClauses.add("(" + normalizedWhereSql + ")");
      }
      if (cursorValue != null) {
        whereClauses.add(quoteIdentifier(cursorColumn) + " > ?");
        queryParams.add(cursorValue);
      }
      queryParams.add(COPY_PAGE_SIZE);

      List<Map<String, Object>> rows =
          sourceJdbcTemplate.query(
              "SELECT "
                  + plan.quotedColumns()
                  + " FROM "
                  + quoteIdentifier(tableName)
                  + (whereClauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", whereClauses))
                  + " ORDER BY "
                  + quoteIdentifier(cursorColumn)
                  + " ASC LIMIT ?",
              (rs, rowNum) -> rowMap(rs, plan.columns()),
              queryParams.toArray());
      if (rows.isEmpty()) {
        return new TableCopySummary(tableName, rowsCopied, chunksCopied);
      }

      if (beforeWritePage != null) {
        beforeWritePage.copy(rows);
      }
      CopyRowsResult writeResult =
          writeRowsInChunks(
              targetJdbcTemplate, tableName, plan, rows, targetTransforms, heartbeatAfterEachCopiedChunk);
      rowsCopied += writeResult.rowsCopied();
      chunksCopied += writeResult.chunksCopied();
      if (afterWritePage != null) {
        afterWritePage.copy(rows);
      }

      cursorValue = rows.get(rows.size() - 1).get(cursorColumn);
      if (cursorValue == null) {
        throw new IllegalStateException(tableName + " 最后一条记录缺少游标值 " + cursorColumn);
      }
    }
  }

  private TableCopySummary copyRows(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      String whereSql,
      List<?> params,
      Map<String, ColumnTransform> targetTransforms,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    PreparedCopyRowsPlan plan = prepareCopyRowsPlan(sourceJdbcTemplate, targetJdbcTemplate, tableName);
    if (plan.columns().isEmpty()) {
      return new TableCopySummary(tableName, 0, 0);
    }
    List<Map<String, Object>> rows =
        sourceJdbcTemplate.query(
            "SELECT "
                + plan.quotedColumns()
                + " FROM "
                + quoteIdentifier(tableName)
                + (StringUtils.hasText(whereSql) ? " " + whereSql : ""),
            (rs, rowNum) -> rowMap(rs, plan.columns()),
            params.toArray());
    CopyRowsResult result =
        writeRowsInChunks(
            targetJdbcTemplate, tableName, plan, rows, targetTransforms, heartbeatAfterEachCopiedChunk);
    return new TableCopySummary(tableName, result.rowsCopied(), result.chunksCopied());
  }

  private CopyRowsResult writeRowsInChunks(
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      PreparedCopyRowsPlan plan,
      List<Map<String, Object>> rows,
      Map<String, ColumnTransform> targetTransforms,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    if (rows.isEmpty() || plan.columns().isEmpty()) {
      return new CopyRowsResult(0, 0);
    }

    long chunksCopied = 0L;
    for (int index = 0; index < rows.size(); index += COPY_CHUNK_SIZE) {
      List<Map<String, Object>> chunk = rows.subList(index, Math.min(index + COPY_CHUNK_SIZE, rows.size()));
      String sql =
          plan.insertVerb()
              + " INTO "
              + quoteIdentifier(tableName)
              + " ("
              + plan.quotedColumns()
              + ") VALUES "
              + String.join(", ", java.util.Collections.nCopies(chunk.size(), plan.valuePlaceholders()))
              + plan.onDuplicateSql();
      List<Object> values = new ArrayList<>(chunk.size() * plan.columns().size());
      for (Map<String, Object> row : chunk) {
        for (String column : plan.columns()) {
          ColumnTransform transform = targetTransforms.get(column);
          values.add(transform == null ? row.get(column) : transform.apply(row.get(column), row));
        }
      }
      targetJdbcTemplate.update(sql, values.toArray());
      heartbeat(heartbeatAfterEachCopiedChunk);
      chunksCopied++;
    }
    return new CopyRowsResult(rows.size(), chunksCopied);
  }

  private PreparedCopyRowsPlan prepareCopyRowsPlan(
      JdbcTemplate sourceJdbcTemplate, JdbcTemplate targetJdbcTemplate, String tableName) {
    List<String> sourceColumns = tableColumns(sourceJdbcTemplate, tableName);
    if (sourceColumns.isEmpty()) {
      throw new IllegalStateException("源租户库缺少用户范围数据表: " + tableName);
    }
    List<String> targetColumnList = tableColumns(targetJdbcTemplate, tableName);
    if (targetColumnList.isEmpty()) {
      throw new IllegalStateException("目标租户库缺少用户范围数据表: " + tableName);
    }
    Set<String> targetColumns = new LinkedHashSet<>(targetColumnList);
    List<String> columns = sourceColumns.stream().filter(targetColumns::contains).toList();
    if (columns.isEmpty()) {
      return PreparedCopyRowsPlan.empty();
    }

    Set<String> primaryColumns = new LinkedHashSet<>(primaryColumns(targetJdbcTemplate, tableName));
    List<String> updateColumns = columns.stream().filter(column -> !primaryColumns.contains(column)).toList();
    String onDuplicateSql =
        updateColumns.isEmpty()
            ? ""
            : " ON DUPLICATE KEY UPDATE "
                + updateColumns.stream()
                    .map(column -> quoteIdentifier(column) + " = VALUES(" + quoteIdentifier(column) + ")")
                    .collect(java.util.stream.Collectors.joining(", "));
    return new PreparedCopyRowsPlan(
        columns,
        updateColumns.isEmpty() ? "INSERT IGNORE" : "INSERT",
        onDuplicateSql,
        columns.stream().map(this::quoteIdentifier).collect(java.util.stream.Collectors.joining(", ")),
        "(" + String.join(", ", java.util.Collections.nCopies(columns.size(), "?")) + ")");
  }

  private List<String> tableColumns(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate.query(
        """
        SELECT COLUMN_NAME
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
        ORDER BY ORDINAL_POSITION ASC
        """,
        (rs, rowNum) -> rs.getString("COLUMN_NAME"),
        tableName);
  }

  private List<String> primaryColumns(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate.query(
        """
        SELECT COLUMN_NAME
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND constraint_name = 'PRIMARY'
        ORDER BY ORDINAL_POSITION ASC
        """,
        (rs, rowNum) -> rs.getString("COLUMN_NAME"),
        tableName);
  }

  private Map<String, Object> rowMap(ResultSet rs, List<String> columns) throws SQLException {
    ResultSetMetaData metadata = rs.getMetaData();
    Map<String, Object> row = new LinkedHashMap<>(columns.size());
    for (int index = 1; index <= metadata.getColumnCount(); index++) {
      row.put(metadata.getColumnLabel(index), rs.getObject(index));
    }
    for (String column : columns) {
      row.putIfAbsent(column, rs.getObject(column));
    }
    return row;
  }

  private List<Long> pickPositiveIds(List<Map<String, Object>> rows, String column) {
    return uniquePositiveNumbers(rows.stream().map(row -> row.get(column)).toList());
  }

  private List<Long> uniquePositiveNumbers(Collection<?> values) {
    List<Long> result = new ArrayList<>();
    for (Object value : values) {
      Long number = positiveLong(value);
      if (number != null && !result.contains(number)) {
        result.add(number);
      }
    }
    return result;
  }

  private Long positiveLong(Object value) {
    if (value == null) {
      return null;
    }
    try {
      long number =
          value instanceof Number numeric ? numeric.longValue() : Long.parseLong(String.valueOf(value));
      return number > 0 ? number : null;
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private boolean numberEquals(Object value, long expected) {
    Long number = positiveLong(value);
    return number != null && number.longValue() == expected;
  }

  private List<String> investmentPhones(UserScopedContext context) {
    List<String> phones = new ArrayList<>();
    addText(phones, context.sourceUsername());
    addText(phones, context.centerPhone());
    return phones;
  }

  private void addText(List<String> values, String value) {
    if (StringUtils.hasText(value)) {
      String normalized = value.trim();
      if (!values.contains(normalized)) {
        values.add(normalized);
      }
    }
  }

  private void addSummary(
      TableCopySummary summary,
      CopySummaryAccumulator memberCopies,
      CopySummaryAccumulator totalCopies) {
    memberCopies.add(summary);
    totalCopies.add(summary);
  }

  private String normalizeWhereClause(String whereSql) {
    String normalized = whereSql == null ? "" : whereSql.trim();
    return normalized.replaceFirst("(?i)^WHERE\\s+", "").trim();
  }

  private String required(String value, String message) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException(message);
    }
    return value.trim();
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return "";
  }

  private void heartbeat(IntSupplier heartbeatAfterEachCopiedChunk) {
    if (heartbeatAfterEachCopiedChunk != null) {
      heartbeatAfterEachCopiedChunk.getAsInt();
    }
  }

  private String placeholders(int count) {
    return String.join(", ", java.util.Collections.nCopies(count, "?"));
  }

  private String quoteIdentifier(String value) {
    return "`" + value.replace("`", "``") + "`";
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

  private interface ColumnTransform {
    Object apply(Object value, Map<String, Object> row);
  }

  private interface PageCallback {
    void copy(List<Map<String, Object>> rows);
  }

  private static final class CopySummaryAccumulator {

    private final Map<String, TableCopySummary> summaries = new LinkedHashMap<>();

    private void add(TableCopySummary summary) {
      if (summary == null) {
        return;
      }
      TableCopySummary existing = summaries.get(summary.tableName());
      summaries.put(
          summary.tableName(),
          existing == null
              ? summary
              : new TableCopySummary(
                  summary.tableName(),
                  existing.rowsCopied() + summary.rowsCopied(),
                  existing.chunksCopied() + summary.chunksCopied()));
    }

    private List<TableCopySummary> summaries() {
      return List.copyOf(summaries.values());
    }

    private long totalRowsCopied() {
      return summaries.values().stream().mapToLong(TableCopySummary::rowsCopied).sum();
    }

    private long copiedChunks() {
      return summaries.values().stream().mapToLong(TableCopySummary::chunksCopied).sum();
    }
  }

  private record SourceUserRow(long id, String username) {}

  private record UserScopedContext(
      long centerUserId,
      String sourceUsername,
      long sourceUserId,
      String targetCustomerId,
      long targetUserId,
      String centerPhone) {}

  private record CopyRowsResult(long rowsCopied, long chunksCopied) {}

  private record PreparedCopyRowsPlan(
      List<String> columns,
      String insertVerb,
      String onDuplicateSql,
      String quotedColumns,
      String valuePlaceholders) {

    private static PreparedCopyRowsPlan empty() {
      return new PreparedCopyRowsPlan(List.of(), "INSERT IGNORE", "", "", "");
    }
  }
}
