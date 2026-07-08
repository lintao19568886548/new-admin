package cn.yizuw.magic.backend.organization;

/** 组织邀请码撤销请求；只允许 Super 撤销当前组织空间的 active 邀请码。 */
public record OrganizationInvitationRevokeRequest(Object id) {}
