package cn.yizuw.magic.backend.image;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** 图片上传服务，负责登录校验、文件校验、哈希去重和租户库写入。 */
@Service
public class ImageService {

  private final ImageRepository imageRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public ImageService(
      ImageRepository imageRepository, TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.imageRepository = imageRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /**
   * 上传图片并返回旧接口兼容结构。
   *
   * <p>旧端只允许 JPG/PNG；重复内容按 SHA-256 复用已有 image 记录。
   */
  public Map<String, Object> upload(MultipartFile file) throws IOException {
    TenantRequired.currentUser();
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有接收到文件");
    }
    DataSource dataSource = tenantJdbcTemplateProvider.currentTenantDataSource();
    return imageRepository.storeImage(dataSource, file, Path.of("public", "uploads"));
  }
}
