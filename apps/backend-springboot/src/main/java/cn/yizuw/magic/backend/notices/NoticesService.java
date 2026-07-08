package cn.yizuw.magic.backend.notices;

import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 公告模块只读服务，保持旧接口登录态要求和分页参数归一化。 */
@Service
@Transactional(readOnly = true)
public class NoticesService {

  private final NoticeLinkValidator noticeLinkValidator;
  private final NoticesRepository noticesRepository;

  public NoticesService(NoticeLinkValidator noticeLinkValidator, NoticesRepository noticesRepository) {
    this.noticeLinkValidator = noticeLinkValidator;
    this.noticesRepository = noticesRepository;
  }

  /** 查询公告列表，公告库异常时由 Repository 返回空页以兼容旧接口。 */
  public Map<String, Object> listNotices(
      Integer currentPage, String keyword, Integer pageSize, String regionCode, Boolean validOnly) {
    TenantRequired.currentUser();
    NoticeListQuery query =
        new NoticeListQuery(
            PageRequestParams.normalizePage(currentPage, 1),
            keyword,
            PageRequestParams.normalizePageSize(pageSize, 20),
            regionCode,
            Boolean.TRUE.equals(validOnly));
    return noticesRepository.findNoticePage(query, noticeLinkValidator);
  }
}
