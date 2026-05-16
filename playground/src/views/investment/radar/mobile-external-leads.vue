<script lang="ts" setup>
import type {
  ExternalLead,
  ExternalLeadConfidenceLevel,
  ExternalLeadDemandType,
  ExternalLeadDetail,
  ExternalLeadStatus,
  LeadEvidence,
} from '#/api/investment';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  CheckCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  convertExternalLeadToRadarLead,
  getExternalLeadDetail,
  getExternalLeadEvidenceList,
  getExternalLeadList,
  updateExternalLead,
} from '#/api/investment';

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileExternalLeads' });

const router = useRouter();

const loading = ref(false);
const detailLoading = ref(false);
const evidenceLoading = ref(false);
const saving = ref(false);
const converting = ref(false);
const detailOpen = ref(false);
const evidenceOpen = ref(false);
const items = ref<ExternalLead[]>([]);
const currentLead = ref<ExternalLeadDetail | null>(null);
const evidenceItems = ref<LeadEvidence[]>([]);

const searchForm = reactive({
  confidenceLevel: '',
  demandType: '',
  industryName: '',
  keyword: '',
  regionCity: '',
  sourceName: '',
  status: '',
});

const editForm = reactive<{
  invalidReason?: string;
  ownerUserId?: number;
  remark?: string;
  status: ExternalLeadStatus;
}>({
  invalidReason: undefined,
  ownerUserId: undefined,
  remark: undefined,
  status: 'NEW',
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const statusOptions: Array<{ label: string; value: '' | ExternalLeadStatus }> =
  [
    { label: '全部状态', value: '' },
    { label: '新线索', value: 'NEW' },
    { label: '待复核', value: 'PENDING_REVIEW' },
    { label: '已分配', value: 'ASSIGNED' },
    { label: '跟进中', value: 'FOLLOWING' },
    { label: '已带看', value: 'VISITED' },
    { label: '已成交', value: 'WON' },
    { label: '无效', value: 'INVALID' },
  ];

const confidenceOptions: Array<{
  label: string;
  value: '' | ExternalLeadConfidenceLevel;
}> = [
  { label: '全部置信度', value: '' },
  { label: '高', value: 'HIGH' },
  { label: '中', value: 'MEDIUM' },
  { label: '低', value: 'LOW' },
];

const demandTypeOptions: Array<{
  label: string;
  value: '' | ExternalLeadDemandType;
}> = [
  { label: '全部需求', value: '' },
  { label: '扩产', value: 'EXPAND' },
  { label: '新增产线', value: 'NEW_LINE' },
  { label: '搬迁', value: 'RELOCATION' },
  { label: '求租厂房', value: 'RENT_FACTORY' },
  { label: '未知', value: 'UNKNOWN' },
];

const editableStatusOptions = statusOptions.filter((item) => item.value);

const statusMeta: Record<ExternalLeadStatus, { color: string; label: string }> =
  {
    ASSIGNED: { color: 'blue', label: '已分配' },
    FOLLOWING: { color: 'processing', label: '跟进中' },
    INVALID: { color: 'red', label: '无效' },
    NEW: { color: 'default', label: '新线索' },
    PENDING_REVIEW: { color: 'orange', label: '待复核' },
    VISITED: { color: 'purple', label: '已带看' },
    WON: { color: 'green', label: '已成交' },
  };

const confidenceMeta: Record<
  ExternalLeadConfidenceLevel,
  { color: string; label: string }
> = {
  HIGH: { color: 'red', label: '高' },
  LOW: { color: 'default', label: '低' },
  MEDIUM: { color: 'gold', label: '中' },
};

const demandTypeLabel: Record<ExternalLeadDemandType, string> = {
  EXPAND: '扩产',
  NEW_LINE: '新增产线',
  RELOCATION: '搬迁',
  RENT_FACTORY: '求租厂房',
  UNKNOWN: '未知',
};

const currentEvidenceCount = computed(() => {
  const detailEvidenceCount = currentLead.value?.evidences?.length || 0;
  return detailEvidenceCount > 0
    ? detailEvidenceCount
    : evidenceItems.value.length;
});

function buildQuery() {
  return {
    confidenceLevel: searchForm.confidenceLevel || undefined,
    currentPage: pagination.current,
    demandType: searchForm.demandType || undefined,
    industryName: searchForm.industryName || undefined,
    keyword: searchForm.keyword || undefined,
    pageSize: pagination.pageSize,
    regionCity: searchForm.regionCity || undefined,
    sourceName: searchForm.sourceName || undefined,
    status: searchForm.status || undefined,
  };
}

function syncEditForm(lead: ExternalLeadDetail) {
  editForm.invalidReason = lead.invalidReason || undefined;
  editForm.ownerUserId = lead.ownerUserId || undefined;
  editForm.remark = lead.remark || undefined;
  editForm.status = lead.status;
}

function resetSearchForm() {
  searchForm.confidenceLevel = '';
  searchForm.demandType = '';
  searchForm.industryName = '';
  searchForm.keyword = '';
  searchForm.regionCity = '';
  searchForm.sourceName = '';
  searchForm.status = '';
}

function renderRegion(lead: ExternalLead) {
  return (
    [lead.regionProvince, lead.regionCity, lead.regionDistrict]
      .filter(Boolean)
      .join(' / ') || '-'
  );
}

function renderSource(lead: ExternalLead) {
  return lead.sourceName || lead.sourceTitle || lead.sourceType || '-';
}

async function loadLeads() {
  loading.value = true;
  try {
    const result = await getExternalLeadList(buildQuery());
    items.value = result.items;
    pagination.total = result.total;
  } catch (error) {
    console.error('加载外部公开线索失败:', error);
    items.value = [];
    pagination.total = 0;
    message.error('外部公开线索加载失败');
  } finally {
    loading.value = false;
  }
}

function searchLeads() {
  pagination.current = 1;
  void loadLeads();
}

function resetSearch() {
  resetSearchForm();
  searchLeads();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void loadLeads();
}

async function openDetail(record: ExternalLead) {
  detailOpen.value = true;
  detailLoading.value = true;
  currentLead.value = null;
  evidenceItems.value = [];
  try {
    const detail = await getExternalLeadDetail(record.leadId);
    currentLead.value = detail;
    evidenceItems.value = detail.evidences || [];
    syncEditForm(detail);
  } catch (error) {
    console.error('加载外部公开线索详情失败:', error);
    message.error('外部公开线索详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function openEvidence(record?: ExternalLead) {
  const target = record || currentLead.value;
  if (!target) {
    return;
  }

  evidenceOpen.value = true;
  evidenceLoading.value = true;
  try {
    const result = await getExternalLeadEvidenceList(target.leadId);
    evidenceItems.value = result.items;
  } catch (error) {
    console.error('加载外部公开线索证据失败:', error);
    message.error('证据加载失败');
  } finally {
    evidenceLoading.value = false;
  }
}

async function saveLead() {
  if (!currentLead.value || saving.value) {
    return;
  }

  saving.value = true;
  try {
    await updateExternalLead(currentLead.value.leadId, {
      invalidReason: editForm.invalidReason?.trim() || null,
      ownerUserId: editForm.ownerUserId || null,
      remark: editForm.remark?.trim() || null,
      status: editForm.status,
    });
    message.success('外部公开线索已更新');
    const detail = await getExternalLeadDetail(currentLead.value.leadId);
    currentLead.value = detail;
    evidenceItems.value = detail.evidences || evidenceItems.value;
    syncEditForm(detail);
    await loadLeads();
  } catch (error) {
    console.error('保存外部公开线索失败:', error);
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function convertLead(record?: ExternalLead) {
  const target = record || currentLead.value;
  if (!target || converting.value) {
    return;
  }

  converting.value = true;
  try {
    const result = await convertExternalLeadToRadarLead(target.leadId, {
      ownerUserId: editForm.ownerUserId || target.ownerUserId || null,
      remark: editForm.remark?.trim() || '外部公开线索确认有效，转入雷达潜客',
    });
    message.success(result.reused ? '已复用现有雷达潜客' : '已转为雷达潜客');
    await loadLeads();
    await router.push(`/investment/radar/mobile/${result.radarLeadId}`);
  } catch (error) {
    console.error('转雷达潜客失败:', error);
    message.error('转雷达潜客失败');
  } finally {
    converting.value = false;
  }
}

onMounted(() => {
  void loadLeads();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <div>
        <h2>外部公开线索</h2>
        <p>公开来源线索复核与转化。</p>
      </div>
      <Button type="primary" :loading="loading" @click="loadLeads">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <div class="radar-mobile-filter">
      <Input
        v-model:value="searchForm.keyword"
        allow-clear
        placeholder="企业 / 标题 / 来源"
        @press-enter="searchLeads"
      />
      <div class="filter-grid">
        <Select
          v-model:value="searchForm.status"
          :options="statusOptions"
          @change="searchLeads"
        />
        <Select
          v-model:value="searchForm.confidenceLevel"
          :options="confidenceOptions"
          @change="searchLeads"
        />
      </div>
      <div class="filter-grid">
        <Select
          v-model:value="searchForm.demandType"
          :options="demandTypeOptions"
          @change="searchLeads"
        />
        <Input
          v-model:value="searchForm.regionCity"
          allow-clear
          placeholder="地区"
          @press-enter="searchLeads"
        />
      </div>
      <div class="filter-grid">
        <Input
          v-model:value="searchForm.industryName"
          allow-clear
          placeholder="行业"
          @press-enter="searchLeads"
        />
        <Input
          v-model:value="searchForm.sourceName"
          allow-clear
          placeholder="来源"
          @press-enter="searchLeads"
        />
      </div>
      <div class="filter-actions">
        <Button type="primary" @click="searchLeads">查询</Button>
        <Button @click="resetSearch">重置</Button>
      </div>
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="radar-mobile-list">
        <Card
          v-for="item in items"
          :key="item.leadId"
          class="radar-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="radar-card-head">
            <div>
              <div class="radar-card-title">{{ item.companyName }}</div>
              <div class="radar-card-subtitle">{{ item.leadTitle }}</div>
            </div>
            <div class="radar-card-tags-row">
              <Tag :color="statusMeta[item.status].color">
                {{ statusMeta[item.status].label }}
              </Tag>
              <Tag :color="confidenceMeta[item.confidenceLevel].color">
                {{ confidenceMeta[item.confidenceLevel].label }}
              </Tag>
            </div>
          </div>

          <div class="radar-card-meta">
            <div class="meta-row">
              <span class="meta-label">需求类型</span>
              <span class="meta-value">
                {{ demandTypeLabel[item.demandType] || item.demandType }}
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">置信分</span>
              <span class="meta-value">{{ item.confidenceScore }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">地区</span>
              <span class="meta-value">{{ renderRegion(item) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">行业</span>
              <span class="meta-value">{{ item.industryName || '-' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">来源</span>
              <span class="meta-value">{{ renderSource(item) }}</span>
            </div>
            <div v-if="item.hitKeywords.length > 0" class="meta-row">
              <span class="meta-label">命中词</span>
              <span class="meta-value">
                <Tag
                  v-for="kw in item.hitKeywords.slice(0, 3)"
                  :key="kw"
                  color="blue"
                >
                  {{ kw }}
                </Tag>
                <span
                  v-if="item.hitKeywords.length > 3"
                  class="text-text-secondary"
                >
                  +{{ item.hitKeywords.length - 3 }}
                </span>
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">证据 / 潜客</span>
              <span class="meta-value">
                {{ item.evidenceCount }} 条 /
                {{
                  item.convertedRadarLeadId
                    ? `#${item.convertedRadarLeadId}`
                    : '未转化'
                }}
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">抓取时间</span>
              <span class="meta-value">{{
                formatDateOnly(item.crawledAt)
              }}</span>
            </div>
          </div>

          <div class="radar-card-actions">
            <Button
              size="small"
              class="radar-action-btn"
              @click="openDetail(item)"
            >
              <FileTextOutlined class="mr-1 h-4 w-4" />
              详情
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              @click="openEvidence(item)"
            >
              <FileSearchOutlined class="mr-1 h-4 w-4" />
              证据
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              type="primary"
              :disabled="Boolean(item.convertedRadarLeadId)"
              :loading="converting"
              @click="convertLead(item)"
            >
              <CheckCircleOutlined class="mr-1 h-4 w-4" />
              转潜客
            </Button>
          </div>
        </Card>

        <Pagination
          v-if="pagination.total > pagination.pageSize"
          class="radar-mobile-pagination"
          size="small"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="onPageChange"
        />
      </div>
      <Empty v-else class="radar-mobile-empty" description="暂无外部公开线索" />
    </Spin>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="外部公开线索详情"
      placement="right"
      width="100%"
    >
      <div v-if="detailLoading" class="drawer-loading">加载中...</div>
      <template v-else-if="currentLead">
        <div class="detail-panel">
          <div class="detail-title">{{ currentLead.companyName }}</div>
          <div class="detail-subtitle">{{ currentLead.leadTitle }}</div>
          <div class="detail-tags">
            <Tag :color="statusMeta[currentLead.status].color">
              {{ statusMeta[currentLead.status].label }}
            </Tag>
            <Tag :color="confidenceMeta[currentLead.confidenceLevel].color">
              置信度 {{ confidenceMeta[currentLead.confidenceLevel].label }}
            </Tag>
          </div>
          <div class="detail-row">
            <span>需求类型</span>
            <strong>
              {{
                demandTypeLabel[currentLead.demandType] ||
                currentLead.demandType
              }}
            </strong>
          </div>
          <div class="detail-row">
            <span>地区</span>
            <strong>{{ renderRegion(currentLead) }}</strong>
          </div>
          <div class="detail-row">
            <span>行业</span>
            <strong>{{ currentLead.industryName || '-' }}</strong>
          </div>
          <div class="detail-row">
            <span>来源</span>
            <strong>{{ renderSource(currentLead) }}</strong>
          </div>
          <div class="detail-row">
            <span>证据数</span>
            <strong>{{ currentEvidenceCount }}</strong>
          </div>
          <div class="detail-block">
            <span>系统判断</span>
            <p>{{ currentLead.summary || '-' }}</p>
          </div>
          <div class="detail-block">
            <span>来源链接</span>
            <a :href="currentLead.sourceUrl" target="_blank" rel="noreferrer">
              {{ currentLead.sourceUrl }}
            </a>
          </div>
        </div>

        <Form layout="vertical" class="review-form">
          <Form.Item label="状态">
            <Select
              v-model:value="editForm.status"
              :options="editableStatusOptions"
            />
          </Form.Item>
          <Form.Item label="负责人用户 ID">
            <InputNumber
              v-model:value="editForm.ownerUserId"
              class="w-full"
              :min="1"
            />
          </Form.Item>
          <Form.Item label="备注">
            <Input.TextArea
              v-model:value="editForm.remark"
              :auto-size="{ minRows: 2, maxRows: 4 }"
            />
          </Form.Item>
          <Form.Item label="无效原因">
            <Input.TextArea
              v-model:value="editForm.invalidReason"
              :auto-size="{ minRows: 2, maxRows: 4 }"
            />
          </Form.Item>
        </Form>

        <div class="radar-drawer-actions">
          <Button type="primary" :loading="saving" @click="saveLead">
            保存
          </Button>
          <Button @click="openEvidence()">证据</Button>
          <Button
            type="primary"
            :disabled="Boolean(currentLead.convertedRadarLeadId)"
            :loading="converting"
            @click="convertLead()"
          >
            转潜客
          </Button>
        </div>
      </template>
    </Drawer>

    <Drawer
      v-model:open="evidenceOpen"
      destroy-on-close
      title="证据链"
      placement="right"
      width="100%"
    >
      <Spin :spinning="evidenceLoading">
        <div v-if="evidenceItems.length > 0" class="evidence-list">
          <Card
            v-for="item in evidenceItems"
            :key="item.evidenceId"
            class="evidence-card"
            :body-style="{ padding: '12px' }"
          >
            <div class="evidence-head">
              <Tag color="blue">{{ item.evidenceType }}</Tag>
              <span>+{{ item.scoreDelta }}</span>
            </div>
            <div class="evidence-title">{{ item.sourceTitle }}</div>
            <div class="evidence-link">
              <a :href="item.sourceLink" target="_blank" rel="noreferrer">
                {{ item.sourceLink }}
              </a>
            </div>
            <div
              v-if="item.matchedKeywords.length > 0"
              class="evidence-keywords"
            >
              <Tag v-for="kw in item.matchedKeywords" :key="kw" color="gold">
                {{ kw }}
              </Tag>
            </div>
            <div
              v-if="item.matchedSentences.length > 0"
              class="evidence-sentences"
            >
              <p v-for="sentence in item.matchedSentences" :key="sentence">
                {{ sentence }}
              </p>
            </div>
            <pre class="evidence-text">{{ item.rawText || '-' }}</pre>
          </Card>
        </div>
        <Empty v-else description="暂无证据" />
      </Spin>
    </Drawer>
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

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-header {
  background: #2d2d2d;
}

.radar-mobile-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  color: var(--ant-color-text);
}

.radar-mobile-header p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-filter {
  background: #2d2d2d;
}

.filter-grid,
.filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.filter-actions button {
  width: 100%;
}

.radar-mobile-list,
.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card,
.evidence-card {
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-card,
.dark .evidence-card {
  background: #2d2d2d;
}

.radar-mobile-card :deep(.ant-card-body) {
  padding: 13px !important;
}

.radar-card-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-card-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
}

.radar-card-subtitle {
  display: -webkit-box;
  margin-top: 2px;
  overflow: hidden;
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.radar-card-tags-row,
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.radar-card-meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  flex-shrink: 0;
  min-width: 76px;
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.meta-value {
  flex: 1;
  color: var(--ant-color-text);
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
  margin-top: 12px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  justify-content: center;
}

.radar-card-actions > :last-child:nth-child(odd),
.radar-drawer-actions > :last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.radar-mobile-pagination {
  display: flex;
  justify-content: center;
  margin: 6px 0 0;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.drawer-loading {
  padding: 36px 0;
  color: var(--ant-color-text-secondary);
  text-align: center;
}

.detail-panel {
  padding: 12px;
  margin-bottom: 12px;
  background: var(--ant-color-fill-tertiary);
  border-radius: 8px;
}

.detail-title {
  color: var(--ant-color-text);
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
}

.detail-subtitle {
  margin-top: 4px;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.detail-tags {
  justify-content: flex-start;
  margin-top: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
}

.detail-row span,
.detail-block span {
  flex-shrink: 0;
  color: var(--ant-color-text-secondary);
}

.detail-row strong {
  color: var(--ant-color-text);
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

.detail-block {
  margin-top: 10px;
}

.detail-block p,
.detail-block a {
  display: block;
  margin: 4px 0 0;
  color: var(--ant-color-text);
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.review-form {
  margin-top: 12px;
}

.radar-drawer-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.evidence-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.evidence-head span {
  color: var(--ant-color-success);
  font-weight: 700;
}

.evidence-title {
  margin-top: 8px;
  color: var(--ant-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.evidence-link {
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.evidence-sentences {
  margin-top: 8px;
}

.evidence-sentences p {
  padding: 8px;
  margin: 0 0 6px;
  color: var(--ant-color-text);
  font-size: 13px;
  line-height: 20px;
  background: var(--ant-color-fill-tertiary);
  border-radius: 6px;
}

.evidence-text {
  max-height: 220px;
  padding: 8px;
  margin: 8px 0 0;
  overflow: auto;
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  background: var(--ant-color-fill-tertiary);
  border-radius: 6px;
}
</style>
