package cn.yizuw.magic.backend.organization;

/** 组织邀请码创建请求；roleIds 兼容旧端数组或逗号字符串传参。 */
public record OrganizationInvitationCreateRequest(
    Object roleIds, Object maxUses, Object expiresAt, Object remark) {}
