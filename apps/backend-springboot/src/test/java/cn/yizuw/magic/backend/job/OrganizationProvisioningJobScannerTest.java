package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 组织开通任务扫描器测试；使用 JdbcTemplate 替身，不连接真实数据库。 */
class OrganizationProvisioningJobScannerTest {

  @Test
  void scanCandidatesReturnsNotReadyWhenTableMissing() {
    OrganizationProvisioningJobScanner scanner =
        new OrganizationProvisioningJobScanner(new ScannerJdbcTemplate(false, List.of()));

    Map<String, Object> result = scanner.scanCandidates(20);

    assertThat(result)
        .containsEntry("readyCount", 0)
        .containsEntry("requestedLimit", 20)
        .containsEntry("tableReady", false)
        .containsEntry("total", 0);
    assertThat(result.get("items")).isEqualTo(List.of());
  }

  @Test
  void scanCandidatesCapsLimitAndCountsReadyJobs() {
    OrganizationProvisioningJobScanner scanner =
        new OrganizationProvisioningJobScanner(
            new ScannerJdbcTemplate(true, List.of(job(31, true), job(32, false))));

    Map<String, Object> result = scanner.scanCandidates(500);

    assertThat(result)
        .containsEntry("readyCount", 1L)
        .containsEntry("requestedLimit", 100)
        .containsEntry("tableReady", true)
        .containsEntry("total", 2);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0)).containsEntry("id", 31).containsEntry("ready", true);
    assertThat(items.get(1))
        .containsEntry("id", 32)
        .containsEntry("ready", false)
        .containsEntry("blockedReason", "缺少 targetDbName");
  }

  private static Map<String, Object> job(int id, boolean ready) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", id);
    row.put("initiatorCenterUserId", 1001);
    row.put("sourceCustomerId", "public");
    row.put("sourceOrgId", 7);
    row.put("status", "pending");
    row.put("targetCustomerId", "org001");
    row.put("targetDbName", ready ? "tenant_org001" : "");
    row.put("ready", ready);
    row.put("blockedReason", ready ? "" : "缺少 targetDbName");
    return row;
  }

  private static final class ScannerJdbcTemplate extends JdbcTemplate {

    private final boolean tableReady;
    private final List<Map<String, Object>> rows;

    private ScannerJdbcTemplate(boolean tableReady, List<Map<String, Object>> rows) {
      this.tableReady = tableReady;
      this.rows = rows;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(tableReady ? 1L : 0L);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      return (List<T>) rows;
    }
  }
}
