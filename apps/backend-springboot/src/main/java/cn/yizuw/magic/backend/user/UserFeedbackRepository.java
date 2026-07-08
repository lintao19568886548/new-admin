package cn.yizuw.magic.backend.user;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Collections;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

/** 用户反馈写入数据访问层，只操作当前租户库的 `feedback` 与 `image_binding`。 */
@Repository
public class UserFeedbackRepository {

  /**
   * 校验反馈图片是否都存在。
   *
   * <p>旧接口会先查 `image` 表，避免提交不存在的图片 id。这里保持同样边界，不负责上传图片。
   */
  public boolean allImagesExist(JdbcTemplate jdbcTemplate, List<Integer> imageIds) {
    if (imageIds.isEmpty()) {
      return true;
    }
    String placeholders = String.join(",", Collections.nCopies(imageIds.size(), "?"));
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM image WHERE img_id IN (" + placeholders + ")",
            Long.class,
            imageIds.toArray());
    return count != null && count == imageIds.size();
  }

  /** 在一个租户库事务中写入反馈主表和图片绑定，返回新反馈 id。 */
  public int createFeedback(
      JdbcTemplate jdbcTemplate,
      String category,
      String contact,
      String content,
      String clientPlatform,
      List<Integer> imageIds,
      String userAgent,
      UserTokenPayload payload) {
    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Tenant DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    Integer feedbackId =
        transactionTemplate.execute(
            ignored -> {
              int id =
                  insertFeedback(
                      jdbcTemplate,
                      category,
                      contact,
                      content,
                      clientPlatform,
                      userAgent,
                      payload);
              insertImageBindings(jdbcTemplate, id, imageIds);
              return id;
            });
    if (feedbackId == null || feedbackId <= 0) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "创建意见反馈失败");
    }
    return feedbackId;
  }

  private int insertFeedback(
      JdbcTemplate jdbcTemplate,
      String category,
      String contact,
      String content,
      String clientPlatform,
      String userAgent,
      UserTokenPayload payload) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO feedback
                    (category, content, contact, client_platform, source, user_agent,
                     user_id, username, real_name, center_user_id, customer_id)
                  VALUES (?, ?, ?, ?, 'profile', ?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, category);
          statement.setString(2, content);
          statement.setString(3, contact.isEmpty() ? null : contact);
          statement.setString(4, clientPlatform.isEmpty() ? null : clientPlatform);
          statement.setString(5, userAgent == null || userAgent.isBlank() ? null : userAgent);
          statement.setLong(6, payload.id());
          statement.setString(7, payload.username());
          statement.setString(8, null);
          if (payload.centerUserId() == null) {
            statement.setObject(9, null);
          } else {
            statement.setLong(9, payload.centerUserId());
          }
          statement.setString(10, payload.customerId());
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to resolve inserted feedback id");
    }
    return key.intValue();
  }

  private void insertImageBindings(JdbcTemplate jdbcTemplate, int feedbackId, List<Integer> imageIds) {
    if (imageIds.isEmpty()) {
      return;
    }
    jdbcTemplate.batchUpdate(
        """
        INSERT INTO image_binding (biz_type, biz_id, img_id, field, sort)
        VALUES ('feedback', ?, ?, 'gallery', ?)
        """,
        new BatchPreparedStatementSetter() {
          @Override
          public void setValues(PreparedStatement ps, int index) throws java.sql.SQLException {
            ps.setInt(1, feedbackId);
            ps.setInt(2, imageIds.get(index));
            ps.setInt(3, index);
          }

          @Override
          public int getBatchSize() {
            return imageIds.size();
          }
        });
  }
}
