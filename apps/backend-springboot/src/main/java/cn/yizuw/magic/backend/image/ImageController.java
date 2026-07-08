package cn.yizuw.magic.backend.image;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

/** 图片上传接口，兼容旧 Nitro 的哈希去重和返回字段。 */
@RestController
public class ImageController {

  private final ImageService imageService;

  public ImageController(ImageService imageService) {
    this.imageService = imageService;
  }

  /** 上传 JPG/PNG 图片，写入租户库 image 表并返回前端需要的 url/name/thumbUrl。 */
  @PostMapping("/image/upload")
  public ApiResponse<Map<String, Object>> upload(MultipartHttpServletRequest request)
      throws IOException {
    MultipartFile file = request.getFileMap().values().stream().findFirst().orElse(null);
    return ApiResponse.ok(imageService.upload(file));
  }
}
