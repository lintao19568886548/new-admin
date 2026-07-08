package cn.yizuw.magic.backend.system.version;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.system.version.entity.AppVersionEntity;
import cn.yizuw.magic.backend.system.version.mapper.AppVersionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import org.springframework.stereotype.Service;

@Service
public class VersionService {

  private static final String DEFAULT_ANDROID_URL = "https://www.yizuw.cn/download/kvapp_v1.0.0.apk";

  private final AppProperties appProperties;
  private final AppVersionMapper appVersionMapper;

  public VersionService(AppProperties appProperties, AppVersionMapper appVersionMapper) {
    this.appProperties = appProperties;
    this.appVersionMapper = appVersionMapper;
  }

  public AppVersion getLatestVersion() {
    AppVersionEntity version =
        appVersionMapper.selectOne(
            new LambdaQueryWrapper<AppVersionEntity>()
                .orderByDesc(AppVersionEntity::getCreatedAt)
                .last("LIMIT 1"));

    if (version != null) {
      return toResponse(version);
    }

    AppVersionEntity initialVersion = new AppVersionEntity();
    initialVersion.setVersion("1.0.0");
    initialVersion.setAndroidUrl(DEFAULT_ANDROID_URL);
    initialVersion.setNotes("Initial version.");
    appVersionMapper.insert(initialVersion);
    return getLatestVersion();
  }

  private AppVersion toResponse(AppVersionEntity version) {
    return new AppVersion(
        version.getId(),
        version.getVersion(),
        version.getUrl(),
        version.getAndroidUrl(),
        appProperties.getIosStoreUrl(),
        version.getNotes(),
        toOffsetDateTime(version.getCreatedAt()),
        toOffsetDateTime(version.getUpdatedAt()));
  }

  private OffsetDateTime toOffsetDateTime(java.time.LocalDateTime dateTime) {
    if (dateTime == null) {
      return null;
    }
    return dateTime.atZone(ZoneId.systemDefault()).toOffsetDateTime();
  }
}
