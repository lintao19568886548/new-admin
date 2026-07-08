package cn.yizuw.magic.backend.smartmeter;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 智能水电表品牌业务层，统一处理租户库和旧接口宽松入参。 */
@Service
public class SmartMeterBrandService {

  private final SmartMeterBrandRepository smartMeterBrandRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public SmartMeterBrandService(
      SmartMeterBrandRepository smartMeterBrandRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.smartMeterBrandRepository = smartMeterBrandRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getBrandList(
      Integer currentPage,
      Integer pageSize,
      String meterType,
      String brandName,
      String brandCode,
      String protocolType,
      String enabled,
      String isDefault) {
    TenantRequired.currentUser();
    return smartMeterBrandRepository.findBrandPage(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(),
        PageRequestParams.normalizePage(currentPage, 1),
        PageRequestParams.normalizePageSize(pageSize, 20),
        blankToNull(meterType),
        blankToNull(brandName),
        blankToNull(brandCode),
        blankToNull(protocolType),
        normalizeOptionalBoolean(enabled),
        normalizeOptionalBoolean(isDefault));
  }

  public Map<String, Object> getBrandDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "meterBrandId 错误");
    }
    TenantRequired.currentUser();
    return smartMeterBrandRepository.findBrandDetail(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id);
  }

  public List<Map<String, String>> getBrandOptions(String field, String keyword, String meterType) {
    TenantRequired.currentUser();
    return smartMeterBrandRepository.findBrandOptions(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(),
        normalizeBrandOptionField(field),
        blankToNull(keyword),
        blankToNull(meterType));
  }

  /** 新增水电表品牌；默认品牌互斥逻辑由仓储层在同一租户库事务中执行。 */
  public Map<String, Object> createBrand(SmartMeterBrandRequest request) {
    TenantRequired.currentUser();
    Map<String, Object> data = normalizeBrandData(request, true);
    return smartMeterBrandRepository.createBrand(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), data);
  }

  /** 更新水电表品牌；meterType 变更和默认品牌互斥由仓储层按旧端边界处理。 */
  public Map<String, Object> updateBrand(int id, SmartMeterBrandRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "meterBrandId 错误");
    }
    TenantRequired.currentUser();
    Map<String, Object> data = normalizeBrandData(request, false);
    return smartMeterBrandRepository.updateBrand(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id, data);
  }

  /** 删除水电表品牌并返回删除前快照，兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteBrand(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "meterBrandId 错误");
    }
    TenantRequired.currentUser();
    return smartMeterBrandRepository.deleteBrand(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id);
  }

  private String normalizeBrandOptionField(String field) {
    String value = field == null ? "" : field.trim();
    if ("brandCode".equals(value) || "protocolType".equals(value)) {
      return value;
    }
    return "brandName";
  }

  private Map<String, Object> normalizeBrandData(SmartMeterBrandRequest request, boolean create) {
    Map<String, Object> data = new LinkedHashMap<>();
    if (create) {
      data.put("meterType", normalizeRequiredMeterType(request == null ? null : request.meterType()));
      data.put("brandName", requiredText(request == null ? null : request.brandName(), "品牌名称不能为空"));
      data.put("brandCode", requiredText(request == null ? null : request.brandCode(), "品牌编码不能为空").toUpperCase());
      data.put("enabled", normalizeBoolean(request == null ? null : request.enabled(), true));
      data.put("isDefault", normalizeBoolean(request == null ? null : request.isDefault(), false));
    } else if (request != null) {
      if (request.meterType() != null) {
        data.put("meterType", normalizeRequiredMeterType(request.meterType()));
      }
      if (request.brandName() != null) {
        data.put("brandName", requiredText(request.brandName(), "品牌名称不能为空"));
      }
      if (request.brandCode() != null) {
        data.put("brandCode", requiredText(request.brandCode(), "品牌编码不能为空").toUpperCase());
      }
      if (request.enabled() != null) {
        data.put("enabled", normalizeBoolean(request.enabled(), true));
      }
      if (request.isDefault() != null) {
        data.put("isDefault", normalizeBoolean(request.isDefault(), false));
      }
    }
    if (request != null) {
      putNullableText(data, "apiEndpoint", request.apiEndpoint());
      putNullableText(data, "appKey", request.appKey());
      putNullableText(data, "appSecretRef", request.appSecretRef());
      putNullableText(data, "protocolType", request.protocolType());
      putNullableText(data, "remark", request.remark());
    }
    return data;
  }

  private String normalizeRequiredMeterType(String value) {
    String text = value == null ? "" : value.trim();
    if (!"electric".equals(text) && !"water".equals(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "表类型错误");
    }
    return text;
  }

  private void putNullableText(Map<String, Object> data, String key, String value) {
    if (value != null) {
      data.put(key, blankToNull(value));
    }
  }

  private Boolean normalizeOptionalBoolean(Object value) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? normalizeBoolean(value, false) : null;
  }

  private boolean normalizeBoolean(Object value, boolean fallback) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return fallback;
    }
    if (value instanceof Boolean bool) {
      return bool;
    }
    String text = String.valueOf(value).trim();
    return "true".equalsIgnoreCase(text) || "1".equals(text);
  }

  private String requiredText(String value, String message) {
    String text = value == null ? "" : value.trim();
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return text;
  }

  private String blankToNull(String value) {
    String text = value == null ? "" : value.trim();
    return StringUtils.hasText(text) ? text : null;
  }
}
