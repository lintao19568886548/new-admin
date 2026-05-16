<script lang="ts" setup>
import type {
  LeadScoreBreakdown,
  RadarLeadDetail,
  RadarOutreachTaskItem,
} from '#/api/investment';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  Alert,
  Button,
  Card,
  Empty,
  Skeleton,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  getRadarLeadDetail,
  getRadarLeadScoreBreakdown,
  recalculateRadarLeadScore,
} from '#/api/investment';

import {
  formatCollectTaskStatus,
  formatNumber,
  formatTime,
  getPriorityColor,
  getReplyStatusMeta,
  getStageLabel,
  getTaskStatusMeta,
  mapChannel,
  mapTaskType,
  renderTaskResult,
} from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileDetail' });

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const loadError = ref('');
const scoreLoading = ref(false);
const scoreRecalculating = ref(false);
const detail = ref<null | RadarLeadDetail>(null);
const scoreItems = ref<LeadScoreBreakdown[]>([]);

const leadId = computed(() => Number(route.params.id));
const summary = computed(() => ({
  intentScore: detail.value?.intentScore ?? 0,
  matchScore: detail.value?.matchScore ?? 0,
  reachableScore: detail.value?.reachableScore ?? 0,
  totalScore: detail.value?.totalScore ?? 0,
}));

function goBack() {
  router.push('/investment/radar/mobile');
}

function goToTasks() {
  router.push('/investment/radar/mobile-tasks');
}

function navigateLead(targetId?: null | number) {
  if (!targetId) {
    return;
  }
  router.push(`/investment/radar/mobile/${targetId}`);
}

async function loadScoreBreakdown() {
  if (!Number.isFinite(leadId.value) || leadId.value <= 0) {
    scoreItems.value = [];
    return;
  }
  scoreLoading.value = true;
  try {
    const result = await getRadarLeadScoreBreakdown(leadId.value);
    scoreItems.value = Array.isArray(result.items) ? result.items : [];
  } catch (error) {
    console.error('加载移动端评分拆解失败:', error);
    scoreItems.value = [];
  } finally {
    scoreLoading.value = false;
  }
}

async function loadDetail() {
  if (!Number.isFinite(leadId.value) || leadId.value <= 0) {
    detail.value = null;
    loadError.value = '线索参数不正确。';
    loading.value = false;
    return;
  }

  loading.value = true;
  loadError.value = '';
  try {
    detail.value = await getRadarLeadDetail(leadId.value);
    await loadScoreBreakdown();
  } catch (error) {
    console.error('加载移动端线索详情失败:', error);
    detail.value = null;
    loadError.value = '线索详情加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function recalculateScore() {
  if (scoreRecalculating.value || !Number.isFinite(leadId.value)) {
    return;
  }
  scoreRecalculating.value = true;
  try {
    const result = await recalculateRadarLeadScore(leadId.value);
    if (detail.value) {
      detail.value = {
        ...detail.value,
        intentScore: result.intentScore,
        priorityLevel: result.priorityLevel,
        totalScore: result.totalScore,
      };
    }
    await loadScoreBreakdown();
  } catch (error) {
    console.error('移动端重算线索评分失败:', error);
  } finally {
    scoreRecalculating.value = false;
  }
}

function taskStatusColor(task: RadarOutreachTaskItem) {
  return getTaskStatusMeta(task.status).color;
}

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-topbar">
      <Button @click="goBack">返回</Button>
      <Button type="primary" :loading="loading" @click="loadDetail">
        刷新
      </Button>
    </div>

    <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

    <template v-if="loading">
      <Card class="radar-mobile-card" :body-style="{ padding: '13px' }">
        <Skeleton active :paragraph="{ rows: 7 }" />
      </Card>
    </template>

    <template v-else-if="detail">
      <section class="radar-mobile-hero">
        <div class="radar-hero-head">
          <div>
            <h2>{{ detail.enterpriseName || `线索 #${detail.leadId}` }}</h2>
            <p>
              {{ detail.parkName || '未分配园区' }} ·
              {{ detail.ownerName || '未分配负责人' }}
            </p>
          </div>
          <Tag :color="getPriorityColor(detail.priorityLevel)">
            {{ detail.priorityLevel || '-' }} 级
          </Tag>
        </div>
        <div class="radar-card-tags">
          <Tag color="blue">{{ getStageLabel(detail.stage) }}</Tag>
          <span>{{ detail.leadSource || '-' }}</span>
          <span>{{ detail.phoneNumber || '暂无电话' }}</span>
        </div>
      </section>

      <div class="radar-score-grid">
        <div>
          <span>总分</span>
          <strong>{{ summary.totalScore }}</strong>
        </div>
        <div>
          <span>意图</span>
          <strong>{{ summary.intentScore }}</strong>
        </div>
        <div>
          <span>匹配</span>
          <strong>{{ summary.matchScore }}</strong>
        </div>
        <div>
          <span>触达</span>
          <strong>{{ summary.reachableScore }}</strong>
        </div>
      </div>

      <section class="radar-mobile-section">
        <div class="radar-section-head">
          <h3>线索信息</h3>
          <Button size="small" @click="goToTasks">触达任务</Button>
        </div>
        <div class="radar-info-grid">
          <div>
            <span>联系人</span>
            <strong>{{ detail.contactName || '-' }}</strong>
          </div>
          <div>
            <span>意向面积</span>
            <strong>
              {{
                detail.intentArea === null || detail.intentArea === undefined
                  ? '-'
                  : `${formatNumber(detail.intentArea)} ㎡`
              }}
            </strong>
          </div>
          <div>
            <span>最近信号</span>
            <strong>{{ detail.latestSignalType || '-' }}</strong>
          </div>
          <div>
            <span>信号时间</span>
            <strong>{{ formatTime(detail.latestSignalTime) }}</strong>
          </div>
          <div>
            <span>最近联系</span>
            <strong>{{ formatTime(detail.latestContactTime) }}</strong>
          </div>
          <div>
            <span>失效原因</span>
            <strong>{{ detail.invalidReason || '-' }}</strong>
          </div>
        </div>
      </section>

      <section class="radar-mobile-section">
        <div class="radar-section-head">
          <h3>企业信息</h3>
        </div>
        <div class="radar-info-grid">
          <div>
            <span>行业</span>
            <strong>{{ detail.industryName || '-' }}</strong>
          </div>
          <div>
            <span>城市</span>
            <strong>{{ detail.city || '-' }}</strong>
          </div>
          <div>
            <span>注册资本</span>
            <strong>{{ formatNumber(detail.registerCapital) }}</strong>
          </div>
          <div>
            <span>信用代码</span>
            <strong>{{ detail.unifiedSocialCreditCode || '-' }}</strong>
          </div>
          <div class="radar-info-wide">
            <span>地址</span>
            <strong>{{ detail.address || '-' }}</strong>
          </div>
          <div class="radar-info-wide">
            <span>来源</span>
            <strong>
              {{ detail.sourceFirst || '-' }} /
              {{ detail.sourceLatest || '-' }}
            </strong>
          </div>
        </div>
      </section>

      <section class="radar-mobile-section">
        <div class="radar-section-head">
          <h3>最近采集任务</h3>
        </div>
        <div v-if="detail.collectTask" class="radar-info-grid">
          <div>
            <span>任务状态</span>
            <strong>
              {{ formatCollectTaskStatus(detail.collectTask.status) }}
            </strong>
          </div>
          <div>
            <span>任务总量</span>
            <strong>{{ detail.collectTask.total ?? '-' }}</strong>
          </div>
          <div>
            <span>新增 / 更新 / 跳过</span>
            <strong>
              {{ detail.collectTask.created }} /
              {{ detail.collectTask.updated }} /
              {{ detail.collectTask.skipped }}
            </strong>
          </div>
          <div>
            <span>开始时间</span>
            <strong>{{ formatTime(detail.collectTask.startedAt) }}</strong>
          </div>
          <div>
            <span>完成时间</span>
            <strong>{{ formatTime(detail.collectTask.completedAt) }}</strong>
          </div>
          <div class="radar-info-wide">
            <span>错误原因</span>
            <strong>{{ detail.collectTask.errorReason || '-' }}</strong>
          </div>
        </div>
        <Empty v-else class="radar-mobile-empty" description="暂无采集任务" />
      </section>

      <section class="radar-mobile-section">
        <div class="radar-section-head">
          <h3>评分拆解</h3>
          <Button
            size="small"
            type="primary"
            :loading="scoreRecalculating"
            @click="recalculateScore"
          >
            重算
          </Button>
        </div>
        <Spin :spinning="scoreLoading">
          <div v-if="scoreItems.length > 0" class="radar-mini-list">
            <div
              v-for="item in scoreItems"
              :key="item.breakdownId"
              class="radar-mini-card"
            >
              <div class="radar-mini-head">
                <strong>{{ item.ruleName }}</strong>
                <Tag color="green">+{{ item.scoreDelta }}</Tag>
              </div>
              <div class="radar-mini-meta">
                {{ item.ruleCode }} · {{ item.eventType || '-' }}
              </div>
              <p>{{ item.reason || '-' }}</p>
            </div>
          </div>
          <Empty v-else class="radar-mobile-empty" description="暂无评分拆解" />
        </Spin>
      </section>

      <section class="radar-mobile-section">
        <div class="radar-section-head">
          <h3>触达记录</h3>
          <span>{{ detail.outreachSummary?.count || 0 }} 条</span>
        </div>
        <div v-if="detail.outreachTasks.length > 0" class="radar-mini-list">
          <div
            v-for="task in detail.outreachTasks"
            :key="task.taskId"
            class="radar-mini-card"
          >
            <div class="radar-mini-head">
              <strong>{{ mapTaskType(task.taskType) }}</strong>
              <Tag :color="taskStatusColor(task)">
                {{ getTaskStatusMeta(task.status).label }}
              </Tag>
            </div>
            <div class="radar-card-tags">
              <Tag color="blue">{{ mapChannel(task.channel) }}</Tag>
              <Tag :color="getReplyStatusMeta(task.replyStatus).color">
                {{ getReplyStatusMeta(task.replyStatus).label }}
              </Tag>
            </div>
            <div class="radar-card-meta">
              <span>号码：{{ task.phoneNumber || '-' }}</span>
              <span>发送：{{ formatTime(task.sentAt) }}</span>
              <span>回复：{{ formatTime(task.replyTime) }}</span>
              <span>操作人：{{ task.sentByName || '-' }}</span>
            </div>
            <p v-if="renderTaskResult(task) !== '-'">
              {{ renderTaskResult(task) }}
            </p>
          </div>
        </div>
        <Empty v-else class="radar-mobile-empty" description="暂无触达记录" />
      </section>

      <div class="radar-bottom-actions">
        <Button
          block
          :disabled="!detail.navigation?.previousLead"
          @click="navigateLead(detail.navigation?.previousLead?.leadId)"
        >
          上一条
        </Button>
        <Button
          block
          type="primary"
          :disabled="!detail.navigation?.nextLead"
          @click="navigateLead(detail.navigation?.nextLead?.leadId)"
        >
          下一条
        </Button>
      </div>
    </template>

    <Empty v-else class="radar-mobile-empty" description="未找到对应线索" />
  </div>
</template>

<style scoped>
.radar-mobile-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-mobile-page {
  background: #1a1a1a;
}

.radar-mobile-topbar,
.radar-bottom-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-hero,
.radar-mobile-section,
.radar-mobile-card,
.radar-mini-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-hero,
.dark .radar-mobile-section,
.dark .radar-mobile-card,
.dark .radar-mini-card {
  background: #2d2d2d;
}

.radar-mobile-hero {
  padding: 13px;
}

.radar-hero-head,
.radar-section-head,
.radar-mini-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-hero-head h2,
.radar-section-head h3 {
  margin: 0;
  color: var(--ant-color-text);
}

.radar-hero-head h2 {
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  word-break: break-word;
}

.radar-hero-head p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-score-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 8px 0;
}

.radar-score-grid > div {
  padding: 9px 2px;
  text-align: center;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .radar-score-grid > div {
  background: #2d2d2d;
}

.radar-score-grid span,
.radar-info-grid span,
.radar-section-head > span,
.radar-mini-meta,
.radar-card-meta {
  color: var(--ant-color-text-secondary);
}

.radar-score-grid span {
  display: block;
  font-size: 11px;
  line-height: 16px;
}

.radar-score-grid strong {
  display: block;
  font-size: 18px;
  line-height: 24px;
  color: var(--ant-color-text);
}

.radar-mobile-section {
  padding: 13px;
  margin-top: 8px;
}

.radar-section-head {
  align-items: center;
  margin-bottom: 10px;
}

.radar-section-head h3 {
  font-size: 16px;
  font-weight: 700;
  line-height: 22px;
}

.radar-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.radar-info-grid > div {
  min-width: 0;
}

.radar-info-grid span {
  display: block;
  margin-bottom: 2px;
  font-size: 12px;
  line-height: 18px;
}

.radar-info-grid strong {
  display: block;
  font-size: 14px;
  line-height: 21px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-info-wide {
  grid-column: 1 / -1;
}

.radar-mini-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radar-mini-card {
  padding: 11px;
}

.radar-mini-head strong {
  min-width: 0;
  font-size: 15px;
  line-height: 22px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-mini-meta,
.radar-card-meta {
  margin-top: 6px;
  font-size: 12px;
  line-height: 19px;
}

.radar-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 9px;
  font-size: 13px;
}

.radar-mini-card p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
}

.radar-bottom-actions {
  position: sticky;
  bottom: calc(10px + env(safe-area-inset-bottom));
  margin-top: 12px;
  margin-bottom: 0;
}

.radar-mobile-empty {
  padding: 32px 0;
}
</style>
