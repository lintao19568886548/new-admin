package cn.yizuw.magic.backend.system.version;

import java.time.OffsetDateTime;

public record AppVersion(
    Integer id,
    String version,
    String url,
    String androidUrl,
    String iosUrl,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
