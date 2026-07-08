package cn.yizuw.magic.backend.rental.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class RentalTenantRepositoryTest {

  private RentalTenantRepository rentalTenantRepository;
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    rentalTenantRepository = new RentalTenantRepository();
    jdbcTemplate = mock(JdbcTemplate.class);
  }

  @Test
  void findSalaryTenantOptionsReturnsEmptyWhenNoAuthorizedParkIds() {
    assertThat(rentalTenantRepository.findSalaryTenantOptions(jdbcTemplate, List.of(), null)).isEmpty();
    verifyNoInteractions(jdbcTemplate);
  }

  @Test
  void findSalaryTenantOptionsReturnsFromQueryAndContainsAuthorizedParkFilter() {
    when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class)))
        .thenReturn(
            List.of(Map.of("rentalTenantId", 1, "tenantName", "张三", "phoneNumber", "13800000000")));

    List<Map<String, Object>> rows =
        rentalTenantRepository.findSalaryTenantOptions(jdbcTemplate, List.of(101, 202), null);

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
    verify(jdbcTemplate).query(sqlCaptor.capture(), any(RowMapper.class), argsCaptor.capture());

    assertThat(rows).hasSize(1);
    assertThat(sqlCaptor.getValue()).contains("park_id IN (?,?)");
    Object[] args = argsCaptor.getValue();
    assertThat(args).hasSize(4);
    assertThat(List.of(args)).contains(101, 202);
  }
}
