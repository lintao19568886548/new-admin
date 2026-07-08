package cn.yizuw.magic.backend.system.key;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SystemKeyService {

  private static final Set<String> INTERNAL_ONLY_KEYS = Set.of("ALIYUN_BAILIAN_KEY");

  private final JdbcTemplate centerJdbcTemplate;

  public SystemKeyService(JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  public Map<String, Object> getSystemKey(String key) {
    TenantRequired.currentUser();
    if (!StringUtils.hasText(key)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "参数 key 不能为空");
    }
    String keyName = key.trim();
    if (INTERNAL_ONLY_KEYS.contains(keyName)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "key is internal only: " + keyName);
    }

    return centerJdbcTemplate
        .query(
            """
            SELECT `key`, value
            FROM `key`
            WHERE `key` = ?
            LIMIT 1
            """,
            (rs, rowNum) ->
                Map.<String, Object>of("key", rs.getString("key"), "value", normalizeValue(rs.getString("value"))),
            keyName)
        .stream()
        .findFirst()
        .orElseThrow(
            () ->
                new BusinessException(
                    HttpStatus.NOT_FOUND, "系统配置未找到或为空: " + keyName));
  }

  private String normalizeValue(String value) {
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "系统配置未找到或为空");
    }
    return value.trim();
  }
}
