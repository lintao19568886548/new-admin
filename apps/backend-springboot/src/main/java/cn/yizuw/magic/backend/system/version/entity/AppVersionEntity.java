package cn.yizuw.magic.backend.system.version.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("app_versions")
public class AppVersionEntity {

  @TableId(type = IdType.AUTO)
  private Integer id;

  private String version;

  private String url;

  @TableField("android_url")
  private String androidUrl;

  @TableField("ios_url")
  private String iosUrl;

  private String notes;

  @TableField("createdAt")
  private LocalDateTime createdAt;

  @TableField("updatedAt")
  private LocalDateTime updatedAt;

  public Integer getId() {
    return id;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public String getVersion() {
    return version;
  }

  public void setVersion(String version) {
    this.version = version;
  }

  public String getUrl() {
    return url;
  }

  public void setUrl(String url) {
    this.url = url;
  }

  public String getAndroidUrl() {
    return androidUrl;
  }

  public void setAndroidUrl(String androidUrl) {
    this.androidUrl = androidUrl;
  }

  public String getIosUrl() {
    return iosUrl;
  }

  public void setIosUrl(String iosUrl) {
    this.iosUrl = iosUrl;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public LocalDateTime getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(LocalDateTime updatedAt) {
    this.updatedAt = updatedAt;
  }
}
