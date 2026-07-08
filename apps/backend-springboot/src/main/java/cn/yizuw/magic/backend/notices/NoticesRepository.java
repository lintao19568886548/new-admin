package cn.yizuw.magic.backend.notices;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/** 独立公告库只读访问层，对应旧 `noticesPrismaClient`。 */
@Repository
public class NoticesRepository implements DisposableBean {

  private final Environment environment;
  private volatile HikariDataSource noticesDataSource;
  private volatile JdbcTemplate noticesJdbcTemplate;

  public NoticesRepository(Environment environment) {
    this.environment = environment;
  }

  /** 按旧接口字段读取公告表；未配置公告库时返回空页。 */
  public Map<String, Object> findNoticePage(NoticeListQuery query, NoticeLinkValidator validator) {
    JdbcTemplate jdbcTemplate = noticesJdbcTemplate();
    if (jdbcTemplate == null) {
      return page(query, List.of(), 0);
    }
    try {
      return query.validOnly()
          ? findValidOnlyPage(jdbcTemplate, query, validator)
          : findPlainPage(jdbcTemplate, query);
    } catch (Exception error) {
      return page(query, List.of(), 0);
    }
  }

  private Map<String, Object> findPlainPage(JdbcTemplate jdbcTemplate, NoticeListQuery query) {
    List<Object> args = new ArrayList<>();
    String where = whereSql(query, args, false);
    Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notices " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT * FROM notices " + where + " ORDER BY date DESC LIMIT ?, ?",
            (rs, rowNum) -> noticeMap(rs),
            pageArgs.toArray());
    return page(query, rows, total == null ? 0 : total);
  }

  private Map<String, Object> findValidOnlyPage(
      JdbcTemplate jdbcTemplate, NoticeListQuery query, NoticeLinkValidator validator) {
    List<Object> args = new ArrayList<>();
    String where = whereSql(query, args, true);
    Long rawTotal = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notices " + where, Long.class, args.toArray());
    int totalCandidates = rawTotal == null ? 0 : rawTotal.intValue();
    int targetStart = (query.currentPage() - 1) * query.pageSize();
    int targetEnd = targetStart + query.pageSize();
    int targetValidCount = targetEnd + 1;
    int maxScan = Math.min(500, Math.max(targetValidCount * 3, query.pageSize() * 5));
    List<Map<String, Object>> validRows = new ArrayList<>();
    int scanned = 0;

    while (scanned < totalCandidates && scanned < maxScan && validRows.size() < targetValidCount) {
      int take = Math.min(40, Math.min(totalCandidates - scanned, maxScan - scanned));
      List<Object> pageArgs = new ArrayList<>(args);
      pageArgs.add(scanned);
      pageArgs.add(take);
      List<Map<String, Object>> rows =
          jdbcTemplate.query(
              "SELECT * FROM notices " + where + " ORDER BY date DESC LIMIT ?, ?",
              (rs, rowNum) -> noticeMap(rs),
              pageArgs.toArray());
      if (rows.isEmpty()) {
        break;
      }
      scanned += rows.size();
      for (Map<String, Object> row : rows) {
        String title = defaultString(row.get("title"));
        if (title.contains("【")) {
          continue;
        }
        if (validator.isValid(defaultString(row.get("link")), title)) {
          validRows.add(row);
        }
      }
    }

    List<Map<String, Object>> items =
        validRows.subList(Math.min(targetStart, validRows.size()), Math.min(targetEnd, validRows.size()));
    boolean hasMore = validRows.size() > targetEnd || scanned < totalCandidates && items.size() == query.pageSize();
    int total = hasMore ? Math.max(targetEnd + 1, validRows.size()) : validRows.size();
    return page(query, items, total);
  }

  private String whereSql(NoticeListQuery query, List<Object> args, boolean validOnly) {
    List<String> conditions = new ArrayList<>();
    if (StringUtils.hasText(query.keyword())) {
      conditions.add("(title LIKE ? OR owner LIKE ? OR category LIKE ? OR project_type LIKE ? OR type LIKE ?)");
      String like = "%" + query.keyword().trim() + "%";
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    if (StringUtils.hasText(query.regionCode())) {
      String prefix = query.regionCode().trim();
      if (prefix.length() > 4) {
        prefix = prefix.substring(0, 4);
      }
      if (StringUtils.hasText(prefix)) {
        conditions.add("site_code LIKE ?");
        args.add(prefix + "%");
      }
    }
    if (validOnly) {
      conditions.add("link IS NOT NULL");
      conditions.add("link <> ''");
    }
    return conditions.isEmpty() ? "" : "WHERE " + String.join(" AND ", conditions);
  }

  private Map<String, Object> noticeMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("category", rs.getString("category"));
    map.put("createdAt", toIso(rs.getTimestamp("created_at")));
    map.put("date", rs.getString("date"));
    map.put("link", rs.getString("link"));
    map.put("noticeId", rs.getString("notice_id"));
    map.put("owner", rs.getString("owner"));
    map.put("platform", rs.getString("platform"));
    map.put("projectType", rs.getString("project_type"));
    map.put("siteCode", rs.getString("site_code"));
    map.put("title", rs.getString("title"));
    map.put("type", rs.getString("type"));
    map.put("updatedAt", toIso(rs.getTimestamp("updated_at")));
    return map;
  }

  private Map<String, Object> page(NoticeListQuery query, List<Map<String, Object>> items, long total) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("currentPage", query.currentPage());
    result.put("items", items);
    result.put("pageSize", query.pageSize());
    result.put("total", total);
    return result;
  }

  private JdbcTemplate noticesJdbcTemplate() {
    JdbcTemplate current = noticesJdbcTemplate;
    if (current != null) {
      return current;
    }
    String rawUrl = environment.getProperty("NOTICES_DATABASE_URL");
    if (!StringUtils.hasText(rawUrl)) {
      rawUrl = System.getenv("NOTICES_DATABASE_URL");
    }
    if (!StringUtils.hasText(rawUrl)) {
      return null;
    }
    synchronized (this) {
      if (noticesJdbcTemplate == null) {
        DatabaseUrl parsed = DatabaseUrl.parse(rawUrl);
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(parsed.jdbcUrl());
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");
        config.setPoolName("notices-db");
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        if (StringUtils.hasText(parsed.username())) {
          config.setUsername(parsed.username());
        }
        if (parsed.password() != null) {
          config.setPassword(parsed.password());
        }
        noticesDataSource = new HikariDataSource(config);
        noticesJdbcTemplate = new JdbcTemplate(noticesDataSource);
      }
      return noticesJdbcTemplate;
    }
  }

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  @Override
  public void destroy() {
    HikariDataSource dataSource = noticesDataSource;
    if (dataSource != null) {
      dataSource.close();
    }
  }
}
