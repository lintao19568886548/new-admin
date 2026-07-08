package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.IntSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** JDBC 版基础数据复制；对齐旧 worker 的源/目标交集列 upsert 语义。 */
@Component
public class JdbcOrganizationProvisioningBaseDataCopyClient
    implements OrganizationProvisioningBaseDataCopyClient {

  private static final int COPY_CHUNK_SIZE = 200;

  @Override
  public BaseDataCopyResult copyBaseDataTables(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      List<String> tableNames,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(dataSource(targetJdbcUrl));
    List<String> copiedTables = new ArrayList<>();
    long appVersionRowsCopied = 0L;
    long copiedChunks = 0L;
    long totalRowsCopied = 0L;
    for (String tableName : tableNames) {
      CopyRowsResult result =
          copyRows(sourceJdbcTemplate, targetJdbcTemplate, tableName, heartbeatAfterEachCopiedChunk);
      if (result.planReady()) {
        copiedTables.add(tableName);
      }
      if ("app_versions".equals(tableName)) {
        appVersionRowsCopied += result.rowsCopied();
      }
      copiedChunks += result.chunksCopied();
      totalRowsCopied += result.rowsCopied();
    }
    return new BaseDataCopyResult(
        List.copyOf(copiedTables), appVersionRowsCopied, copiedChunks, totalRowsCopied);
  }

  private CopyRowsResult copyRows(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    PreparedCopyRowsPlan plan = prepareCopyRowsPlan(sourceJdbcTemplate, targetJdbcTemplate, tableName);
    if (plan.columns().isEmpty()) {
      return new CopyRowsResult(0, 0, false);
    }
    List<List<Object>> rows =
        sourceJdbcTemplate.query(
            "SELECT " + plan.quotedColumns() + " FROM " + quoteIdentifier(tableName),
            (rs, rowNum) -> {
              List<Object> values = new ArrayList<>(plan.columns().size());
              for (String column : plan.columns()) {
                values.add(rs.getObject(column));
              }
              return values;
            });
    if (rows.isEmpty()) {
      return new CopyRowsResult(0, 0, true);
    }
    long chunksCopied = 0L;
    for (int index = 0; index < rows.size(); index += COPY_CHUNK_SIZE) {
      List<List<Object>> chunk = rows.subList(index, Math.min(index + COPY_CHUNK_SIZE, rows.size()));
      String sql =
          plan.insertVerb()
              + " INTO "
              + quoteIdentifier(tableName)
              + " ("
              + plan.quotedColumns()
              + ") VALUES "
              + String.join(", ", java.util.Collections.nCopies(chunk.size(), plan.valuePlaceholders()))
              + plan.onDuplicateSql();
      Object[] values = chunk.stream().flatMap(List::stream).toArray();
      targetJdbcTemplate.update(sql, values);
      heartbeat(heartbeatAfterEachCopiedChunk);
      chunksCopied++;
    }
    return new CopyRowsResult(rows.size(), chunksCopied, true);
  }

  private PreparedCopyRowsPlan prepareCopyRowsPlan(
      JdbcTemplate sourceJdbcTemplate, JdbcTemplate targetJdbcTemplate, String tableName) {
    List<String> sourceColumns = tableColumns(sourceJdbcTemplate, tableName);
    Set<String> targetColumns = new LinkedHashSet<>(tableColumns(targetJdbcTemplate, tableName));
    List<String> columns = sourceColumns.stream().filter(targetColumns::contains).toList();
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

  private void heartbeat(IntSupplier heartbeatAfterEachCopiedChunk) {
    if (heartbeatAfterEachCopiedChunk != null) {
      heartbeatAfterEachCopiedChunk.getAsInt();
    }
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

  private record CopyRowsResult(long rowsCopied, long chunksCopied, boolean planReady) {}

  private record PreparedCopyRowsPlan(
      List<String> columns,
      String insertVerb,
      String onDuplicateSql,
      String quotedColumns,
      String valuePlaceholders) {}
}
