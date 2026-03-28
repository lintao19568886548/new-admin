<script lang="ts" setup>
import type { SystemFeedbackApi } from '#/api/system/feedback';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Empty, Image, Tag } from 'ant-design-vue';

import { FEEDBACK_CATEGORY_OPTIONS } from '../data';

const feedback = ref<null | SystemFeedbackApi.FeedbackItem>(null);

const categoryColorMap = new Map(
  FEEDBACK_CATEGORY_OPTIONS.map((item) => [item.value, item.color]),
);

const feedbackTitle = computed(() =>
  feedback.value ? `反馈详情 #${feedback.value.id}` : '反馈详情',
);

const [Modal, modalApi] = useVbenModal({
  footer: false,
  onOpenChange(isOpen) {
    feedback.value = isOpen
      ? modalApi.getData<SystemFeedbackApi.FeedbackItem>()
      : null;
  },
  showCancelButton: false,
  showConfirmButton: false,
});
</script>

<template>
  <Modal :title="feedbackTitle" :width="920">
    <div v-if="feedback" class="feedback-detail">
      <div class="feedback-meta-grid">
        <div class="meta-card">
          <span class="meta-label">反馈类型</span>
          <div class="meta-value">
            <Tag :color="categoryColorMap.get(feedback.category)">
              {{ feedback.categoryLabel }}
            </Tag>
          </div>
        </div>
        <div class="meta-card">
          <span class="meta-label">提交时间</span>
          <span class="meta-value">
            {{
              feedback.createTime ? formatDateTime(feedback.createTime) : '-'
            }}
          </span>
        </div>
        <div class="meta-card">
          <span class="meta-label">提交人</span>
          <span class="meta-value">
            {{ feedback.realName || feedback.username || '-' }}
          </span>
        </div>
        <div class="meta-card">
          <span class="meta-label">联系方式</span>
          <span class="meta-value">{{ feedback.contact || '-' }}</span>
        </div>
        <!-- <div class="meta-card">
          <span class="meta-label">来源</span>
          <span class="meta-value">{{ feedback.source || '-' }}</span>
        </div> -->
        <!-- <div class="meta-card">
          <span class="meta-label">客户端</span>
          <span class="meta-value">{{ feedback.clientPlatform || '-' }}</span>
        </div> -->
      </div>

      <section class="detail-section">
        <h3 class="section-title">反馈内容</h3>
        <div class="content-card">
          {{ feedback.content || '-' }}
        </div>
      </section>

      <section class="detail-section">
        <h3 class="section-title">上传图片</h3>
        <div v-if="feedback.images.length > 0" class="image-grid">
          <Image.PreviewGroup>
            <div
              v-for="imageItem in feedback.images"
              :key="imageItem.id"
              class="image-card"
            >
              <Image
                :src="imageItem.imgUrl"
                :width="120"
                :height="120"
                class="preview-image"
              />
            </div>
          </Image.PreviewGroup>
        </div>
        <Empty v-else description="未上传图片" />
      </section>

      <section v-if="feedback.userAgent" class="detail-section">
        <h3 class="section-title">设备信息</h3>
        <div class="content-card content-card-muted">
          {{ feedback.userAgent }}
        </div>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.feedback-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feedback-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.meta-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
}

.meta-label {
  font-size: 12px;
  color: #8c8c8c;
}

.meta-value {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  word-break: break-word;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
}

.content-card {
  padding: 16px;
  word-break: break-word;
  white-space: pre-wrap;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
}

.content-card-muted {
  color: #595959;
  background: #fafafa;
}

.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image-card {
  overflow: hidden;
  border-radius: 12px;
}

.preview-image :deep(img) {
  object-fit: cover;
}

.dark .meta-card {
  background: rgb(255 255 255 / 4%);
  border-color: rgb(255 255 255 / 10%);
}

.dark .meta-value,
.dark .section-title {
  color: rgb(255 255 255 / 88%);
}

.dark .content-card {
  background: rgb(255 255 255 / 4%);
  border-color: rgb(255 255 255 / 10%);
}

@media (max-width: 640px) {
  .feedback-meta-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
