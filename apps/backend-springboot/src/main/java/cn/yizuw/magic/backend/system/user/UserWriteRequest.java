package cn.yizuw.magic.backend.system.user;

import java.util.List;

/** 用户账号新增/更新请求，兼容旧 Nitro user 写接口字段。 */
public record UserWriteRequest(
    Object parkIds,
    String password,
    String phone,
    String realName,
    Object roleIds,
    Object status,
    String username) {}
