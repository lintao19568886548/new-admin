package cn.yizuw.magic.backend.llm;

import cn.yizuw.magic.backend.common.BusinessException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/** 本地 LLM 兼容服务；真实百炼接入需后续专项补齐密钥、限流、缓存和审计。 */
@Service
public class LlmService {

  private static final long AMOUNT_BILL_FILE_MAX_SIZE_BYTES = 150L * 1024L * 1024L;

  /**
   * 校验总账单 Excel 文件并返回旧接口字段结构。
   *
   * <p>旧 Nitro 会上传文件到百炼并轮询解析结果；迁移期不外呼，只返回空结果和 `_meta`，
   * 防止接口切流时产生不可控的三方调用、费用和超时。
   */
  public Map<String, Object> analyzeAmountBill(MultipartFile file, String formulaContext) {
    if (file == null || file.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "Missing Excel file");
    }
    String fileName = StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "";
    if (!fileName.toLowerCase(java.util.Locale.ROOT).endsWith(".xlsx")) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "Bailian direct file parsing currently supports only .xlsx files");
    }
    if (file.getSize() > AMOUNT_BILL_FILE_MAX_SIZE_BYTES) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "Excel file is too large");
    }

    Map<String, Object> result = emptyAmountBillResult();
    result.put(
        "_meta",
        Map.of(
            "externalCall",
            false,
            "fileName",
            fileName,
            "fileSize",
            file.getSize(),
            "formulaContextProvided",
            StringUtils.hasText(formulaContext),
            "mode",
            "local_stub"));
    return result;
  }

  /**
   * 校验租户合同图片 data URL 并返回旧接口字段结构。
   *
   * <p>真实图片识别需要百炼多模态模型，迁移期只保留参数边界和空字段结构。
   */
  public Map<String, Object> analyzeTenantImages(TenantImagesAnalyzeRequest request) {
    List<String> dataUrls =
        request == null || request.dataUrls() == null
            ? List.of()
            : request.dataUrls().stream()
                .map(value -> value == null ? "" : value.trim())
                .filter(StringUtils::hasText)
                .limit(8)
                .toList();
    if (dataUrls.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有可识别的图片");
    }

    long totalLength = dataUrls.stream().mapToLong(String::length).sum();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tenantName", "");
    result.put("phoneNumber", "");
    result.put("contractDate", Map.of("end", "", "start", ""));
    result.put("address", "");
    result.put("rent", "");
    result.put("area", "");
    result.put(
        "_meta",
        Map.of(
            "externalCall",
            false,
            "imageCount",
            dataUrls.size(),
            "mode",
            "local_stub",
        "totalDataUrlLength",
        totalLength));
    return result;
  }

  /** 智谱 Chat 兼容入口；不外呼 bigmodel，只返回本地占位响应。 */
  public Map<String, Object> chatZhipu(ChatZhipuRequest request) {
    String message = request == null || request.message() == null ? "" : request.message().trim();
    if (!StringUtils.hasText(message)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "message不能为空");
    }
    String model = request == null || request.model() == null ? "" : request.model().trim();
    return Map.of(
        "choices",
        List.of(
            Map.of(
                "finish_reason",
                "local_stub",
                "index",
                0,
                "message",
                Map.of("content", "", "role", "assistant"))),
        "created",
        java.time.Instant.now().getEpochSecond(),
        "externalCall",
        false,
        "id",
        "local-zhipu-stub",
        "model",
        StringUtils.hasText(model) ? model : "local-zhipu-stub",
        "object",
        "chat.completion");
  }

  private Map<String, Object> emptyAmountBillResult() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tenantName", "");
    result.put("projectName", "");
    result.put("parkName", "");
    result.put("receiptTime", "");
    result.put("receiptAmount", "");
    result.put("eleFee", "");
    result.put("waterFee", "");
    result.put("factoryRent", "");
    result.put("managementFee", "");
    result.put("garbageFee", "");
    result.put("serviceFee", "");
    result.put("invoiceTax", "");
    result.put("penaltyFee", "");
    result.put("totalFee", "");
    result.put("remark", "");
    result.put("publicBankAccount", Map.of("bank", "", "name", "", "number", ""));
    result.put("privateBankAccount", Map.of("bank", "", "name", "", "number", ""));
    result.put("eleItems", List.of());
    result.put("waterItems", List.of());
    result.put("extraProjectItems", List.of());
    return result;
  }
}
