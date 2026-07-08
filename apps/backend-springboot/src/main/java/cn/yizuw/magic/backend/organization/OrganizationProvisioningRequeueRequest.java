package cn.yizuw.magic.backend.organization;

/**
 * 组织空间开通 failed_manual 任务重排请求。
 *
 * <p>字段保留 Object 类型以兼容旧 Nitro 接口的宽松 JSON 入参；业务层会做强校验。
 */
public record OrganizationProvisioningRequeueRequest(
    Object confirmation, Object execute, Object jobId, Object reason) {}
