<script lang="ts" setup>
import type { EmployeeApi } from '#/api/hrm/employee';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDate, formatDateTime } from '@vben/utils';

import { Tag } from 'ant-design-vue';

import { $t } from '#/locales';

const employee = ref<EmployeeApi.Employee | null>(null);

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = modalApi.getData<EmployeeApi.Employee>();
      employee.value = data;
    }
  },
});
</script>
<template>
  <Modal :width="800" :closable="false">
    <div v-if="employee" class="employee-detail">
      <!-- 基本信息 -->
      <div class="detail-section">
        <h3 class="section-title">{{ $t('基本信息') }}</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">{{ $t('姓名') }}</span>
            <span class="detail-value">{{ employee.name }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('性别') }}</span>
            <span class="detail-value">{{ employee.gender }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('电话') }}</span>
            <span class="detail-value">{{ employee.phone }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('年龄') }}</span>
            <span class="detail-value">{{ employee.age }}</span>
          </div>
          <div class="detail-item detail-item-full">
            <span class="detail-label">{{ $t('身份证号') }}</span>
            <span class="detail-value">{{ employee.idNumber }}</span>
          </div>
          <div class="detail-item detail-item-full">
            <span class="detail-label">{{ $t('住址信息') }}</span>
            <span class="detail-value">{{ employee.address }}</span>
          </div>
        </div>
      </div>

      <!-- 工作信息 -->
      <div class="detail-section">
        <h3 class="section-title">{{ $t('工作信息') }}</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">{{ $t('学历') }}</span>
            <span class="detail-value">{{ employee.education }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('部门') }}</span>
            <span class="detail-value">{{ employee.department }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('打卡时间') }}</span>
            <span class="detail-value">
              {{ formatDate(employee.checkIn, 'HH:mm') }} -
              {{ formatDate(employee.checkOut, 'HH:mm') }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('在职状态') }}</span>
            <span class="detail-value">
              <Tag :color="employee.isResigned ? 'red' : 'green'">
                {{ employee.isResigned ? $t('离职') : $t('在职') }}
              </Tag>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('入职日期') }}</span>
            <span class="detail-value">{{
              formatDateTime(String(employee.hireDate))
            }}</span>
          </div>
          <div class="detail-item" v-if="employee.isResigned">
            <span class="detail-label">{{ $t('离职日期') }}</span>
            <span class="detail-value">{{
              formatDateTime(String(employee.leaveDate))
            }}</span>
          </div>

          <div class="detail-item detail-item-full">
            <span class="detail-label">{{ $t('备注') }}</span>
            <span class="detail-value">{{ employee.remark }}</span>
          </div>
        </div>
      </div>

      <!-- 系统信息 -->
      <div class="detail-section">
        <h3 class="section-title">{{ $t('系统信息') }}</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">{{ $t('创建时间') }}</span>
            <span class="detail-value">{{
              formatDateTime(String(employee.createTime))
            }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ $t('更新时间') }}</span>
            <span class="detail-value">{{
              formatDateTime(String(employee.updateTime))
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* 移动端响应式 */
@media (max-width: 768px) {
  :deep(.ant-modal) {
    top: 0;
    max-width: 100vw;
    margin: 0;
  }

  :deep(.ant-modal-content) {
    display: flex;
    flex-direction: column;
    height: 100vh;
    border-radius: 0;
  }

  :deep(.ant-modal-body) {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .detail-item-full {
    grid-column: span 1;
  }

  .detail-item {
    min-height: 75px;
    padding: 16px 14px;
  }

  .section-title {
    margin-bottom: 12px;
    font-size: 16px;
  }

  .detail-label {
    margin-bottom: 10px;
    font-size: 11px;
  }

  .detail-value {
    font-size: 12px;
    line-height: 1.4;
  }

  :deep(.ant-tag) {
    padding: 2px 6px;
    font-size: 12px;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  :deep(.ant-modal-body) {
    padding: 12px;
  }

  .detail-section {
    margin-bottom: 20px;
  }

  .detail-item {
    padding: 8px;
  }

  .section-title {
    margin-bottom: 10px;
    font-size: 14px;
  }

  .detail-label {
    font-size: 10px;
  }

  .detail-value {
    font-size: 12px;
  }

  .detail-grid {
    gap: 10px;
  }
}

.employee-detail {
  padding: 0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  position: relative;
  display: inline-block;
  padding: 8px 0;
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  border-bottom: none;
}

.section-title.main-title {
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
}

.section-title.main-title::after {
  position: absolute;
  bottom: -6px;
  left: 50%;
  width: 60px;
  height: 4px;
  content: '';
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 4px;
  transform: translateX(-50%);
}

.section-title::after {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  content: '';
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 3px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  min-height: 80px;
  padding: 18px 16px;
  background: transparent;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
  transition: all 0.3s ease;
}

.detail-item:hover {
  border-color: #9ca3af;
  box-shadow: 0 4px 16px rgb(156 163 175 / 15%);
  transform: translateY(-2px);
}

.detail-item-full {
  grid-column: span 2;
}

.detail-label {
  position: relative;
  display: inline-block;
  padding-bottom: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 13px;
  hyphens: auto;
  line-height: 1.5;
  color: #1f2937;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 深色模式适配 */
.dark .section-title {
  color: #f9fafb;
}

.dark .section-title.main-title {
  color: #f9fafb;
}

.dark .section-title::after {
  background: linear-gradient(90deg, #60a5fa, #93c5fd);
}

.dark .section-title.main-title::after {
  background: linear-gradient(90deg, #60a5fa, #93c5fd);
}

.dark .detail-item {
  background: transparent;
  border-color: #4b5563;
  box-shadow: 0 2px 8px rgb(0 0 0 / 20%);
}

.dark .detail-item:hover {
  border-color: #6b7280;
  box-shadow: 0 4px 16px rgb(107 114 128 / 30%);
  transform: translateY(-2px);
}

.dark .detail-label {
  color: #9ca3af;
}

.dark .detail-label::after {
  background-color: #6b7280;
}

.dark .detail-value {
  color: #f9fafb;
}
</style>
