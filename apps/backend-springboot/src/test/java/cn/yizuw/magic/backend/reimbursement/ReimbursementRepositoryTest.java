package cn.yizuw.magic.backend.reimbursement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.BusinessException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ReimbursementRepositoryTest {

  private ReimbursementRepository reimbursementRepository;
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    reimbursementRepository = new ReimbursementRepository();
    jdbcTemplate = mock(JdbcTemplate.class);
  }

  @Test
  void analysisWithInvalidStartDateThrowsBusinessException() {
    when(jdbcTemplate.queryForList(any(String.class), eq(String.class), eq("reimbursement")))
        .thenReturn(List.of("id", "purpose", "amount", "status", "park_id", "date"));

    ReimbursementScope scope = new ReimbursementScope(true, 1L, List.of(1));

    BusinessException exception =
        assertThrows(
            BusinessException.class,
            () ->
                reimbursementRepository.analysis(
                    jdbcTemplate, "2026-13-01", "2026-06-30", 1, null, scope));
    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(exception.getMessage()).contains("startDate参数错误");
  }

  @Test
  void analysisWithReversedDateRangeShouldNormalizeOrderAndQuery() {
    when(jdbcTemplate.queryForList(any(String.class), eq(String.class), eq("reimbursement")))
        .thenReturn(List.of("id", "purpose", "amount", "status", "park_id", "date"));
    when(jdbcTemplate.query(any(String.class), any(RowMapper.class), any(Object[].class)))
        .thenReturn(List.of());

    ReimbursementScope scope = new ReimbursementScope(true, 1L, List.of(1));
    // audit analysis adds park scope first, then status/date range args
    assertThat(
            reimbursementRepository.analysis(
                jdbcTemplate, "2026-06-30", "2026-06-01", 1, 0, scope))
        .containsKey("summary");

    ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
    verify(jdbcTemplate).query(anyString(), any(RowMapper.class), argsCaptor.capture());
    Object[] args = argsCaptor.getValue();
    assertThat(args).hasSize(4);
    assertThat(args[0]).isEqualTo(1);
    assertThat(args[1]).isEqualTo(0);
    assertThat(args[2]).isEqualTo("2026-06-01 00:00:00");
    assertThat(args[3]).isEqualTo("2026-06-30 23:59:59");
  }

  @Test
  void createWithNegativeAmountShouldThrowBusinessException() {
    when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq("reimbursement")))
        .thenReturn(
            List.of("id", "purpose", "amount", "payee", "status", "park_id", "date", "is_deleted"));

    ReimbursementCreateRequest request =
        new ReimbursementCreateRequest(
            BigDecimal.valueOf(-1),
            "张三",
            "2026-07-01",
            "财务部",
            null,
            "支付宝",
            null,
            "报销事由",
            "备注",
            0,
            "张三");
    BusinessException exception =
        assertThrows(
            BusinessException.class,
            () ->
                reimbursementRepository.create(
                    jdbcTemplate, request, new ReimbursementScope(false, 1L, List.of())));
    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(exception.getMessage()).contains("报销金额必须大于0");
  }

  @Test
  void createWithHugeAmountShouldThrowBusinessException() {
    when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq("reimbursement")))
        .thenReturn(
            List.of("id", "purpose", "amount", "payee", "status", "park_id", "date", "is_deleted"));

    ReimbursementCreateRequest request =
        new ReimbursementCreateRequest(
            new BigDecimal("10000000000000"),
            "张三",
            "2026-07-01",
            "财务部",
            null,
            "支付宝",
            null,
            "报销事由",
            "备注",
            0,
            "张三");

    BusinessException exception =
        assertThrows(
            BusinessException.class,
            () ->
                reimbursementRepository.create(
                    jdbcTemplate, request, new ReimbursementScope(false, 1L, List.of())));
    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(exception.getMessage()).contains("报销金额不能超过");
  }
}
