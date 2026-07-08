package cn.yizuw.magic.backend.llm;

import cn.yizuw.magic.backend.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

/** LLM 兼容接口；迁移期只做本地输入校验和占位结果，不外呼百炼。 */
@RestController
public class LlmController {

  private final LlmService llmService;

  public LlmController(LlmService llmService) {
    this.llmService = llmService;
  }

  /** 总账单 Excel AI 解析兼容入口；当前不上传文件到百炼。 */
  @PostMapping("/llm/amount-bill-analyze")
  public ApiResponse<Map<String, Object>> analyzeAmountBill(HttpServletRequest request) {
    MultipartFile file = null;
    String formulaContext = null;
    if (request instanceof MultipartHttpServletRequest multipartRequest) {
      file = multipartRequest.getFileMap().values().stream().findFirst().orElse(null);
      formulaContext = multipartRequest.getParameter("formulaContext");
    }
    return ApiResponse.ok(llmService.analyzeAmountBill(file, formulaContext));
  }

  /** 租户合同图片 AI 识别兼容入口；当前只返回空字段结构和本地模式元信息。 */
  @PostMapping("/llm/tenant-images")
  public ApiResponse<Map<String, Object>> analyzeTenantImages(
      @RequestBody(required = false) TenantImagesAnalyzeRequest request) {
    return ApiResponse.ok(llmService.analyzeTenantImages(request));
  }
}
