package cn.yizuw.magic.backend.image;

import cn.yizuw.magic.backend.common.BusinessException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/** 图片上传数据访问层，所有数据库写入都限定在当前租户库。 */
@Repository
public class ImageRepository {

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final Set<String> ALLOWED_CONTENT_TYPES =
      Set.of("image/jpeg", "image/jpg", "image/png");

  /** 保存图片文件和 image 表记录；若哈希已存在则直接返回旧记录。 */
  public Map<String, Object> storeImage(DataSource dataSource, MultipartFile file, Path uploadDir)
      throws IOException {
    String contentType = normalize(file.getContentType());
    if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "只能上传JPG/PNG格式的图片");
    }
    byte[] bytes = file.getBytes();
    String hash = sha256(bytes);
    String originalFilename =
        StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "unknown";
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
    ensureImageTableReadable(jdbcTemplate);

    Map<String, Object> existing = findImageByHash(jdbcTemplate, hash);
    if (existing != null) {
      return uploadResponse(existing.get("imgId"), existing.get("imgUrl"), originalFilename, true);
    }

    Files.createDirectories(uploadDir);
    String fileName = generatedFileName(originalFilename);
    Path filePath = uploadDir.resolve(fileName);
    String fileUrl = "/uploads/" + fileName;
    Files.write(filePath, bytes);

    try {
      TransactionTemplate transactionTemplate =
          new TransactionTemplate(new DataSourceTransactionManager(dataSource));
      Integer imgId =
          transactionTemplate.execute(
              ignored -> insertImage(jdbcTemplate, fileUrl, hash));
      return uploadResponse(imgId, fileUrl, originalFilename, false);
    } catch (RuntimeException error) {
      Files.deleteIfExists(filePath);
      throw error;
    }
  }

  private void ensureImageTableReadable(JdbcTemplate jdbcTemplate) {
    Set<String> columns = columnSet(jdbcTemplate, "image");
    if (!columns.containsAll(Set.of("img_id", "img_url", "hash"))) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "图片表未初始化，请先执行 db push");
    }
  }

  private Map<String, Object> findImageByHash(JdbcTemplate jdbcTemplate, String hash) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT img_id, img_url FROM image WHERE hash = ? LIMIT 1",
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("imgId", rs.getInt("img_id"));
              row.put("imgUrl", rs.getString("img_url"));
              return row;
            },
            hash);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Integer insertImage(JdbcTemplate jdbcTemplate, String imgUrl, String hash) {
    PreparedStatementCreator creator =
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  "INSERT INTO image (img_url, hash) VALUES (?, ?)",
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, imgUrl);
          statement.setString(2, hash);
          return statement;
        };
    var keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
    jdbcTemplate.update(creator, keyHolder);
    Number key = keyHolder.getKey();
    return key == null ? null : key.intValue();
  }

  private Map<String, Object> uploadResponse(
      Object imgId, Object url, String originalFilename, boolean duplicated) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("imgId", imgId);
    result.put("url", url);
    result.put("name", originalFilename);
    result.put("thumbUrl", url);
    return result;
  }

  private String generatedFileName(String originalFilename) {
    String sanitized = originalFilename.replaceAll("[\\\\/:*?\"<>|]", "_");
    int dotIndex = sanitized.lastIndexOf('.');
    String baseName = dotIndex > 0 ? sanitized.substring(0, dotIndex) : sanitized;
    String extension = dotIndex > 0 ? sanitized.substring(dotIndex + 1) : "png";
    if (!StringUtils.hasText(baseName)) {
      baseName = "upload";
    }
    baseName = baseName.length() > 200 ? baseName.substring(0, 200) : baseName;
    extension = extension.length() > 10 ? extension.substring(0, 10) : extension;
    byte[] suffixBytes = new byte[3];
    RANDOM.nextBytes(suffixBytes);
    return baseName
        + "."
        + System.currentTimeMillis()
        + "."
        + HexFormat.of().formatHex(suffixBytes)
        + "."
        + extension;
  }

  private String sha256(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is unavailable", error);
    }
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private Set<String> columnSet(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate
        .queryForList(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            String.class,
            tableName)
        .stream()
        .map(name -> name.toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }
}
