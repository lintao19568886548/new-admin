package cn.yizuw.magic.backend.organization;

/** 组织邀请码加入请求；code 会去除空白和横线并转为大写。 */
public record OrganizationInvitationJoinRequest(Object code) {}
