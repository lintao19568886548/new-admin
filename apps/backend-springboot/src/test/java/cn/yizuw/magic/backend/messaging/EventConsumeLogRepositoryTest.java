package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** event_consume_log 幂等仓储测试；不连接真实数据库。 */
class EventConsumeLogRepositoryTest {

  @Test
  void claimProcessingReturnsClaimedWhenInsertSucceeds() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    EventConsumeClaimResult result = repository.claimProcessing(entry());

    assertThat(result).isEqualTo(EventConsumeClaimResult.CLAIMED);
    assertThat(jdbcTemplate.status).isEqualTo("processing");
  }

  @Test
  void claimProcessingReturnsDuplicateWhenAlreadySucceeded() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    jdbcTemplate.duplicate = true;
    jdbcTemplate.existingStatus = "success";
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    EventConsumeClaimResult result = repository.claimProcessing(entry());

    assertThat(result).isEqualTo(EventConsumeClaimResult.DUPLICATE_SUCCESS);
    assertThat(jdbcTemplate.reclaimAttempted).isFalse();
  }

  @Test
  void claimProcessingReclaimsFailedConsumeLog() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    jdbcTemplate.duplicate = true;
    jdbcTemplate.existingStatus = "failed";
    jdbcTemplate.reclaimUpdatedRows = 1;
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    EventConsumeClaimResult result = repository.claimProcessing(entry());

    assertThat(result).isEqualTo(EventConsumeClaimResult.CLAIMED);
    assertThat(jdbcTemplate.reclaimAttempted).isTrue();
    assertThat(jdbcTemplate.status).isEqualTo("processing");
  }

  @Test
  void claimProcessingReturnsInProgressWhenExistingRowIsProcessing() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    jdbcTemplate.duplicate = true;
    jdbcTemplate.existingStatus = "processing";
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    EventConsumeClaimResult result = repository.claimProcessing(entry());

    assertThat(result).isEqualTo(EventConsumeClaimResult.IN_PROGRESS);
  }

  @Test
  void recordSuccessReturnsTrueWhenInsertSucceeds() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    boolean inserted = repository.recordSuccess(entry());

    assertThat(inserted).isTrue();
    assertThat(jdbcTemplate.status).isEqualTo("success");
    assertThat(jdbcTemplate.errorMessage).isNull();
  }

  @Test
  void recordSuccessReturnsFalseWhenEventAlreadyConsumedByGroup() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    jdbcTemplate.duplicate = true;
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    boolean inserted = repository.recordSuccess(entry());

    assertThat(inserted).isFalse();
  }

  @Test
  void recordFailureTruncatesLongErrorMessage() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    boolean inserted = repository.recordFailure(entry(), "x".repeat(1200));

    assertThat(inserted).isTrue();
    assertThat(jdbcTemplate.status).isEqualTo("failed");
    assertThat(jdbcTemplate.errorMessage).hasSize(1000);
  }

  @Test
  void markSuccessClearsErrorMessage() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    repository.markSuccess(entry());

    assertThat(jdbcTemplate.status).isEqualTo("success");
    assertThat(jdbcTemplate.errorMessage).isNull();
  }

  @Test
  void markFailureTruncatesLongErrorMessage() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate();
    EventConsumeLogRepository repository = new EventConsumeLogRepository(jdbcTemplate);

    repository.markFailure(entry(), "x".repeat(1200));

    assertThat(jdbcTemplate.status).isEqualTo("failed");
    assertThat(jdbcTemplate.errorMessage).hasSize(1000);
  }

  private EventConsumeLogEntry entry() {
    return new EventConsumeLogEntry(
        "backend-springboot",
        "evt_1",
        "organization.provisioning.completed",
        "organization-provisioning-completed:31",
        "magic.organization.provisioning");
  }

  private static final class CapturingJdbcTemplate extends JdbcTemplate {

    boolean duplicate;
    String errorMessage;
    String existingStatus;
    boolean reclaimAttempted;
    int reclaimUpdatedRows;
    String status;

    @Override
    public int update(String sql, Object... args) {
      String normalizedSql = sql.toLowerCase();
      if (normalizedSql.contains("update event_consume_log")
          && normalizedSql.contains("status = 'success'")) {
        status = "success";
        errorMessage = null;
        return 1;
      }
      if (normalizedSql.contains("update event_consume_log")
          && normalizedSql.contains("status = 'processing'")) {
        reclaimAttempted = true;
        status = "processing";
        errorMessage = null;
        return reclaimUpdatedRows;
      }
      if (normalizedSql.contains("update event_consume_log")
          && normalizedSql.contains("status = 'failed'")) {
        status = "failed";
        errorMessage = (String) args[0];
        return 1;
      }
      if (duplicate) {
        throw new DuplicateKeyException("duplicate consume log");
      }
      status = normalizedSql.contains("'processing'") ? "processing" : String.valueOf(args[5]);
      errorMessage = normalizedSql.contains("'processing'") ? null : (String) args[6];
      return 1;
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      return existingStatus == null ? List.of() : (List<T>) List.of(existingStatus);
    }
  }
}
