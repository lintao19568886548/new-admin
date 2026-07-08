package cn.yizuw.magic.backend.smartmeter;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** 智能水电表品牌数据访问层；所有 SQL 都使用调用方传入的当前租户库连接。 */
@Repository
public class SmartMeterBrandRepository {

  /** 查询水电表品牌分页，兼容旧接口 meterType 和品牌字段筛选。 */
  public PageResult<Map<String, Object>> findBrandPage(
      JdbcTemplate jdbcTemplate,
      int currentPage,
      int pageSize,
      String meterType,
      String brandName,
      String brandCode,
      String protocolType,
      Boolean enabled,
      Boolean isDefault) {
    List<Object> args = new ArrayList<>();
    String where = "WHERE 1 = 1";
    if (StringUtils.hasText(meterType)) {
      where += " AND meter_type = ?";
      args.add(meterType.trim());
    }
    if (StringUtils.hasText(brandName)) {
      where += " AND brand_name LIKE ?";
      args.add("%" + brandName.trim() + "%");
    }
    if (StringUtils.hasText(brandCode)) {
      where += " AND brand_code LIKE ?";
      args.add("%" + brandCode.trim() + "%");
    }
    if (StringUtils.hasText(protocolType)) {
      where += " AND protocol_type LIKE ?";
      args.add("%" + protocolType.trim() + "%");
    }
    if (enabled != null) {
      where += " AND enabled = ?";
      args.add(enabled);
    }
    if (isDefault != null) {
      where += " AND is_default = ?";
      args.add(isDefault);
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM meter_brand " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            "SELECT * FROM meter_brand "
                + where
                + " ORDER BY is_default DESC, meter_brand_id DESC LIMIT ?, ?",
            (rs, rowNum) -> brandMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, currentPage, pageSize);
  }

  /** 查询水电表品牌详情；旧接口允许不存在时 data 为 null。 */
  public Map<String, Object> findBrandDetail(JdbcTemplate jdbcTemplate, int meterBrandId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT *
            FROM meter_brand
            WHERE meter_brand_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> brandMap(rs),
            meterBrandId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询水电表品牌搜索候选；支持按 meterType 缩小范围。 */
  public List<Map<String, String>> findBrandOptions(
      JdbcTemplate jdbcTemplate, String field, String keyword, String meterType) {
    String columnName = brandOptionColumn(field);
    List<Object> args = new ArrayList<>();
    String where = "WHERE 1 = 1";
    if (StringUtils.hasText(meterType)) {
      where += " AND meter_type = ?";
      args.add(meterType.trim());
    }
    if (StringUtils.hasText(keyword)) {
      where += " AND " + columnName + " LIKE ?";
      args.add("%" + keyword.trim() + "%");
    }
    List<String> values =
        jdbcTemplate.query(
            "SELECT brand_name, brand_code, protocol_type FROM meter_brand "
                + where
                + " ORDER BY is_default DESC, meter_brand_id DESC LIMIT 200",
            (rs, rowNum) -> switch (field) {
              case "brandCode" -> rs.getString("brand_code");
              case "protocolType" -> rs.getString("protocol_type");
              default -> rs.getString("brand_name");
            },
            args.toArray());
    return toOptionList(values);
  }

  /** 新增水电表品牌；isDefault=true 时只清理同 meterType 的其它默认品牌。 */
  public Map<String, Object> createBrand(JdbcTemplate jdbcTemplate, Map<String, Object> data) {
    return transactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              if (Boolean.TRUE.equals(data.get("isDefault"))) {
                ensureSingleDefaultMeterBrand(jdbcTemplate, String.valueOf(data.get("meterType")), null);
              }
              KeyHolder keyHolder = new GeneratedKeyHolder();
              jdbcTemplate.update(
                  connection -> {
                    PreparedStatement statement =
                        connection.prepareStatement(
                            """
                            INSERT INTO meter_brand (
                              api_endpoint, app_key, app_secret_ref, brand_code, brand_name,
                              enabled, is_default, meter_type, protocol_type, remark,
                              create_time, update_time
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                            """,
                            Statement.RETURN_GENERATED_KEYS);
                    statement.setObject(1, data.get("apiEndpoint"));
                    statement.setObject(2, data.get("appKey"));
                    statement.setObject(3, data.get("appSecretRef"));
                    statement.setObject(4, data.get("brandCode"));
                    statement.setObject(5, data.get("brandName"));
                    statement.setObject(6, data.get("enabled"));
                    statement.setObject(7, data.get("isDefault"));
                    statement.setObject(8, data.get("meterType"));
                    statement.setObject(9, data.get("protocolType"));
                    statement.setObject(10, data.get("remark"));
                    return statement;
                  },
                  keyHolder);
              Number key = keyHolder.getKey();
              if (key == null) {
                throw new IllegalStateException("Failed to resolve inserted meter brand id");
              }
              return findBrandDetail(jdbcTemplate, key.intValue());
            });
  }

  /** 更新水电表品牌；仅写白名单字段，不触发表计平台同步。 */
  public Map<String, Object> updateBrand(
      JdbcTemplate jdbcTemplate, int meterBrandId, Map<String, Object> data) {
    Map<String, Object> current = findBrandDetail(jdbcTemplate, meterBrandId);
    if (current == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "水电表品牌不存在");
    }
    return transactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              if (Boolean.TRUE.equals(data.get("isDefault"))) {
                String meterType =
                    data.containsKey("meterType")
                        ? String.valueOf(data.get("meterType"))
                        : String.valueOf(current.get("meterType"));
                ensureSingleDefaultMeterBrand(jdbcTemplate, meterType, meterBrandId);
              }
              List<Object> args = new ArrayList<>();
              List<String> assignments = new ArrayList<>();
              appendAssignment(assignments, args, data, "apiEndpoint", "api_endpoint");
              appendAssignment(assignments, args, data, "appKey", "app_key");
              appendAssignment(assignments, args, data, "appSecretRef", "app_secret_ref");
              appendAssignment(assignments, args, data, "brandCode", "brand_code");
              appendAssignment(assignments, args, data, "brandName", "brand_name");
              appendAssignment(assignments, args, data, "enabled", "enabled");
              appendAssignment(assignments, args, data, "isDefault", "is_default");
              appendAssignment(assignments, args, data, "meterType", "meter_type");
              appendAssignment(assignments, args, data, "protocolType", "protocol_type");
              appendAssignment(assignments, args, data, "remark", "remark");
              if (assignments.isEmpty()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要更新的数据");
              }
              assignments.add("update_time = CURRENT_TIMESTAMP");
              args.add(meterBrandId);
              jdbcTemplate.update(
                  "UPDATE meter_brand SET "
                      + String.join(", ", assignments)
                      + " WHERE meter_brand_id = ?",
                  args.toArray());
              return findBrandDetail(jdbcTemplate, meterBrandId);
            });
  }

  /** 删除水电表品牌并返回删除前快照。 */
  public Map<String, Object> deleteBrand(JdbcTemplate jdbcTemplate, int meterBrandId) {
    Map<String, Object> current = findBrandDetail(jdbcTemplate, meterBrandId);
    if (current == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "水电表品牌不存在");
    }
    jdbcTemplate.update("DELETE FROM meter_brand WHERE meter_brand_id = ?", meterBrandId);
    return current;
  }

  private void ensureSingleDefaultMeterBrand(
      JdbcTemplate jdbcTemplate, String meterType, Integer excludeId) {
    if (excludeId == null) {
      jdbcTemplate.update(
          """
          UPDATE meter_brand
          SET is_default = false, update_time = CURRENT_TIMESTAMP
          WHERE meter_type = ?
          """,
          meterType);
      return;
    }
    jdbcTemplate.update(
        """
        UPDATE meter_brand
        SET is_default = false, update_time = CURRENT_TIMESTAMP
        WHERE meter_type = ? AND meter_brand_id <> ?
        """,
        meterType,
        excludeId);
  }

  private void appendAssignment(
      List<String> assignments,
      List<Object> args,
      Map<String, Object> data,
      String key,
      String columnName) {
    if (data.containsKey(key)) {
      assignments.add(columnName + " = ?");
      args.add(data.get(key));
    }
  }

  private String brandOptionColumn(String field) {
    return switch (field) {
      case "brandCode" -> "brand_code";
      case "protocolType" -> "protocol_type";
      default -> "brand_name";
    };
  }

  private List<Map<String, String>> toOptionList(List<String> values) {
    List<Map<String, String>> options = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (String rawValue : values) {
      String value = rawValue == null ? "" : rawValue.trim();
      if (!StringUtils.hasText(value)) {
        continue;
      }
      if (seen.add(value.toLowerCase())) {
        options.add(Map.of("label", value, "value", value));
      }
      if (options.size() >= 100) {
        break;
      }
    }
    return options;
  }

  private TransactionTemplate transactionTemplate(JdbcTemplate jdbcTemplate) {
    if (jdbcTemplate.getDataSource() == null) {
      throw new IllegalStateException("Tenant DataSource is not available");
    }
    return new TransactionTemplate(new DataSourceTransactionManager(jdbcTemplate.getDataSource()));
  }

  private Map<String, Object> brandMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("apiEndpoint", rs.getString("api_endpoint"));
    map.put("appKey", rs.getString("app_key"));
    map.put("appSecretRef", rs.getString("app_secret_ref"));
    map.put("brandCode", rs.getString("brand_code"));
    map.put("brandName", rs.getString("brand_name"));
    map.put("enabled", toBoolean(rs.getObject("enabled")));
    map.put("isDefault", toBoolean(rs.getObject("is_default")));
    map.put("meterBrandId", rs.getInt("meter_brand_id"));
    map.put("meterType", rs.getString("meter_type"));
    map.put("protocolType", rs.getString("protocol_type"));
    map.put("remark", rs.getString("remark"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    return map;
  }

  private Boolean toBoolean(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return "true".equalsIgnoreCase(text) || "1".equals(text);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
