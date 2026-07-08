package cn.yizuw.magic.backend.organization;

import java.util.Map;

/**
 * 公开试用空间创建组织请求。
 *
 * <p>旧接口允许字段位于 `organizationIdentity` 嵌套对象，也允许直接放在根字段；Service 会统一归一化。
 */
public record OrganizationCreateRequest(
    String city,
    String companyName,
    String companyShortName,
    String organizationCity,
    String organizationCompanyName,
    String organizationCompanyShortName,
    Map<String, Object> organizationIdentity) {}
