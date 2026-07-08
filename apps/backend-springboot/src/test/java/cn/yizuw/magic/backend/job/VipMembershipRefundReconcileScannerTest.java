package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 会员退款对账扫描器测试；只验证候选集预检，不连接真实微信或数据库。 */
class VipMembershipRefundReconcileScannerTest {

  @Test
  void scanCandidatesReturnsNotReadyWhenTableMissing() {
    VipMembershipRefundReconcileScanner scanner =
        new VipMembershipRefundReconcileScanner(new ScannerJdbcTemplate(false, List.of()));

    Map<String, Object> result = scanner.scanCandidates(20);

    assertThat(result)
        .containsEntry("readyCount", 0)
        .containsEntry("requestedLimit", 20)
        .containsEntry("tableReady", false)
        .containsEntry("total", 0);
    assertThat(result.get("items")).isEqualTo(List.of());
  }

  @Test
  void scanCandidatesCapsLimitAndCountsReadyRefunds() {
    VipMembershipRefundReconcileScanner scanner =
        new VipMembershipRefundReconcileScanner(
            new ScannerJdbcTemplate(
                true, List.of(refund(91, "vip_refund_wxapp_1", "wxapp_1", "customer_1"))));

    Map<String, Object> result = scanner.scanCandidates(500);

    assertThat(result)
        .containsEntry("readyCount", 1L)
        .containsEntry("requestedLimit", 100)
        .containsEntry("tableReady", true)
        .containsEntry("total", 1);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("id", 91)
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("plannedAction", "query_then_create_wechat_refund")
        .containsEntry("ready", true)
        .containsEntry("blockedReason", "");
  }

  @Test
  void scanCandidatesPlansQueryOnlyForPendingProviderRefunds() {
    VipMembershipRefundReconcileScanner scanner =
        new VipMembershipRefundReconcileScanner(
            new ScannerJdbcTemplate(
                true,
                List.of(refund(93, "vip_refund_wxapp_3", "wxapp_3", "customer_1", "PROCESSING"))));

    Map<String, Object> result = scanner.scanCandidates(2);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("ready", true)
        .containsEntry("plannedAction", "query_wechat_refund");
  }

  @Test
  void scanCandidatesMarksRefundsWithoutRequiredFieldsBlocked() {
    VipMembershipRefundReconcileScanner scanner =
        new VipMembershipRefundReconcileScanner(
            new ScannerJdbcTemplate(true, List.of(refund(92, "vip_refund_wxapp_2", "", ""))));

    Map<String, Object> result = scanner.scanCandidates(2);

    assertThat(result)
        .containsEntry("readyCount", 0L)
        .containsEntry("requestedLimit", 2)
        .containsEntry("tableReady", true)
        .containsEntry("total", 1);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("ready", false)
        .containsEntry("blockedReason", "缺少 outTradeNo");
  }

  private static RefundFixture refund(
      int id, String outRefundNo, String outTradeNo, String customerId) {
    return refund(id, outRefundNo, outTradeNo, customerId, "CREATE_PENDING");
  }

  private static RefundFixture refund(
      int id, String outRefundNo, String outTradeNo, String customerId, String status) {
    return new RefundFixture(id, outRefundNo, outTradeNo, customerId, status);
  }

  private record RefundFixture(
      int id, String outRefundNo, String outTradeNo, String customerId, String status) {}

  private static final class ScannerJdbcTemplate extends JdbcTemplate {

    private final boolean tableReady;
    private final List<RefundFixture> rows;

    private ScannerJdbcTemplate(boolean tableReady, List<RefundFixture> rows) {
      this.tableReady = tableReady;
      this.rows = rows;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(tableReady ? 1L : 0L);
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      return rows.stream().map(row -> map(rowMapper, row)).toList();
    }

    private <T> T map(RowMapper<T> rowMapper, RefundFixture row) {
      try {
        return rowMapper.mapRow(resultSet(row), 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(RefundFixture row) throws SQLException {
      ResultSet resultSet = mock(ResultSet.class);
      Timestamp now = Timestamp.from(Instant.parse("2026-07-02T08:00:00Z"));
      when(resultSet.getInt("id")).thenReturn(row.id());
      when(resultSet.getObject("amount_total")).thenReturn(98_000);
      when(resultSet.getObject("center_user_id")).thenReturn(1001);
      when(resultSet.getObject("refund_amount")).thenReturn(98_000);
      when(resultSet.getString("channel")).thenReturn("springboot_local");
      when(resultSet.getString("customer_id")).thenReturn(row.customerId());
      when(resultSet.getString("out_refund_no")).thenReturn(row.outRefundNo());
      when(resultSet.getString("out_trade_no")).thenReturn(row.outTradeNo());
      when(resultSet.getString("reason")).thenReturn("用户申请退款");
      when(resultSet.getString("refund_id")).thenReturn(null);
      when(resultSet.getString("status")).thenReturn(row.status());
      when(resultSet.getString("transaction_id")).thenReturn("4200001");
      when(resultSet.getTimestamp("create_time")).thenReturn(now);
      when(resultSet.getTimestamp("last_checked_at")).thenReturn(null);
      when(resultSet.getTimestamp("next_check_at")).thenReturn(now);
      when(resultSet.getTimestamp("requested_at")).thenReturn(now);
      when(resultSet.getTimestamp("success_at")).thenReturn(null);
      when(resultSet.getTimestamp("update_time")).thenReturn(now);
      return resultSet;
    }
  }
}
