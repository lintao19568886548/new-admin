package cn.yizuw.magic.backend.crm;

/**
 * 微信小程序测试码请求。
 *
 * <p>旧接口会调用微信生成真实小程序码；Spring Boot 迁移期只生成本地 PNG data URL，避免测试环境依赖微信配置。
 */
public record CrmMiniProgramQrcodeTestRequest(
    Object envVersion, Object page, Object scene, Integer width) {}
