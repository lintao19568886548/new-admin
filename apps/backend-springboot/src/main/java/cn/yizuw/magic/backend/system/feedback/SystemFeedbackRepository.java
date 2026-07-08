package cn.yizuw.magic.backend.system.feedback;

import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class SystemFeedbackRepository {

  private static final Map<String, String> CATEGORY_LABELS =
      Map.of(
          "bug", "问题异常",
          "experience", "体验优化",
          "feature", "功能建议",
          "other", "其他反馈");

  public PageResult<Map<String, Object>> findFeedbackPage(
      JdbcTemplate jdbcTemplate,
      String category,
      Integer currentPage,
      String endTime,
      String keyword,
      Integer pageSize,
      String startTime) {
    int page = PageRequestParams.normalizePage(currentPage, 1);
    int size = PageRequestParams.normalizePageSize(pageSize, 20);
    List<Object> args = new ArrayList<>();
    String where = buildWhere(args, category, endTime, keyword, startTime);
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM feedback f " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((page - 1) * size);
    pageArgs.add(size);
    List<Map<String, Object>> feedbacks =
        jdbcTemplate.query(
            """
            SELECT f.*
            FROM feedback f
            """
                + where
                + """
                ORDER BY f.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> feedbackMap(rs),
            pageArgs.toArray());
    enrichImages(jdbcTemplate, feedbacks);
    return new PageResult<>(feedbacks, total == null ? 0 : total, page, size);
  }

  private String buildWhere(
      List<Object> args, String category, String endTime, String keyword, String startTime) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE 1=1 AND ", "");
    if (StringUtils.hasText(category)) {
      where.add("f.category = ?");
      args.add(category.trim());
    }
    if (StringUtils.hasText(keyword)) {
      where.add(
          "(f.content LIKE ? OR f.contact LIKE ? OR f.username LIKE ? OR f.real_name LIKE ?)");
      String like = "%" + keyword.trim() + "%";
      args.add(like);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    if (StringUtils.hasText(startTime)) {
      where.add("f.create_time >= ?");
      args.add(startTime.trim());
    }
    if (StringUtils.hasText(endTime)) {
      where.add("f.create_time <= ?");
      args.add(endTime.trim());
    }
    return where.toString();
  }

  private void enrichImages(JdbcTemplate jdbcTemplate, List<Map<String, Object>> feedbacks) {
    if (feedbacks.isEmpty()) {
      return;
    }
    List<Integer> ids = feedbacks.stream().map(item -> (Integer) item.get("id")).toList();
    String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
    Map<Integer, List<Map<String, Object>>> imagesByFeedbackId = new LinkedHashMap<>();
    jdbcTemplate.query(
        """
        SELECT ib.id, ib.biz_id, ib.img_id, ib.field, ib.sort, i.img_url
        FROM image_binding ib
        INNER JOIN image i ON i.img_id = ib.img_id
        WHERE ib.biz_type = 'feedback'
          AND ib.field = 'gallery'
          AND ib.biz_id IN (
        """
            + placeholders
            + """
        )
        ORDER BY ib.biz_id ASC, ib.sort ASC
        """,
        rs -> {
          Map<String, Object> image = new LinkedHashMap<>();
          image.put("id", rs.getInt("id"));
          image.put("imgId", rs.getInt("img_id"));
          image.put("imgUrl", rs.getString("img_url"));
          image.put("field", rs.getString("field"));
          image.put("sort", rs.getInt("sort"));
          imagesByFeedbackId
              .computeIfAbsent(rs.getInt("biz_id"), ignored -> new ArrayList<>())
              .add(image);
        },
        ids.toArray());
    for (Map<String, Object> feedback : feedbacks) {
      List<Map<String, Object>> images =
          imagesByFeedbackId.getOrDefault((Integer) feedback.get("id"), List.of());
      feedback.put("images", images);
      feedback.put("imageCount", images.size());
    }
  }

  private Map<String, Object> feedbackMap(ResultSet rs) throws SQLException {
    String category = rs.getString("category");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getInt("id"));
    map.put("category", category);
    map.put("categoryLabel", CATEGORY_LABELS.getOrDefault(category, category));
    map.put("content", rs.getString("content"));
    map.put("contact", rs.getString("contact"));
    map.put("clientPlatform", rs.getString("client_platform"));
    map.put("source", rs.getString("source"));
    map.put("userAgent", rs.getString("user_agent"));
    map.put("userId", rs.getObject("user_id", Integer.class));
    map.put("username", rs.getString("username"));
    map.put("realName", rs.getString("real_name"));
    map.put("centerUserId", rs.getObject("center_user_id", Integer.class));
    map.put("customerId", rs.getString("customer_id"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("images", List.of());
    map.put("imageCount", 0);
    return map;
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
