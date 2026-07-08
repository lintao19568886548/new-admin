package cn.yizuw.magic.backend.crm;

/**
 * CRM 邀请解析请求。
 *
 * <p>字段来源于旧 Nitro `/api/crm/invite/resolve.post.ts`，其中 ip/userAgent 由 Controller
 * 从请求头补入，避免客户端伪造覆盖服务端采集值。
 */
public record CrmInviteResolveRequest(
    String scene,
    String source,
    String customerName,
    String phone,
    String openid,
    String unionid,
    String ip,
    String userAgent) {}
