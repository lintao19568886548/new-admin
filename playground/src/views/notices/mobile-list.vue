<script lang="ts" setup>
import type { NoticeItem, NoticeListResponse } from '#/api/notices';

import { computed, onMounted, reactive, ref } from 'vue';

import { Search } from '@vben/icons';

import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Pagination,
  Select,
  Spin,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getNoticeList } from '#/api/notices';
import { $t } from '#/locales';

import { getCityNameByCode, GUANGDONG_CITY_CODE_MAP } from './data';

const list = ref<NoticeItem[]>([]);
const loading = ref(false);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const searchForm = reactive({
  keyword: '',
  regionCode: undefined as string | undefined,
});

const regionOptions = Object.entries(GUANGDONG_CITY_CODE_MAP).map(
  ([code, name]) => ({
    label: name,
    value: code.slice(0, 4),
  }),
);

const keywordText = computed(() => String(searchForm.keyword ?? '').trim());

const listIsEmpty = computed(() => !loading.value && list.value.length === 0);

function formatPublishDate(value: string) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const d = dayjs(s, 'YYYYMMDDHHmmss', true);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : s;
}

function openNoticeLink(link?: string) {
  const href = String(link ?? '').trim();
  if (!href) {
    message.warning('暂无可跳转链接');
    return;
  }

  window.open(href, '_blank', 'noopener,noreferrer');
}

async function fetchList() {
  if (loading.value) return;
  loading.value = true;

  try {
    const result = (await getNoticeList({
      currentPage: pagination.current,
      keyword: keywordText.value || undefined,
      pageSize: pagination.pageSize,
      regionCode: String(searchForm.regionCode ?? '').trim() || undefined,
    })) as NoticeListResponse;

    list.value = Array.isArray(result?.items) ? result.items : [];
    pagination.total = Number(result?.total ?? 0);
  } catch (error) {
    console.error('获取公告列表失败:', error);
    message.error('获取公告列表失败');
    list.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

function resolveCityName(it: any) {
  const code = String(it?.site_code ?? it?.siteCode ?? '').trim();
  return getCityNameByCode(code);
}

function handleSearch() {
  pagination.current = 1;
  fetchList();
}

function handleReset() {
  searchForm.keyword = '';
  searchForm.regionCode = undefined;
  handleSearch();
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchList();
}

onMounted(() => {
  fetchList();
});
</script>

<template>
  <div class="notices-mobile-page">
    <div class="search-filters">
      <Form layout="vertical" :model="searchForm">
        <Form.Item label="关键字">
          <Input
            v-model:value="searchForm.keyword"
            placeholder="标题/单位/分类"
            allow-clear
          />
        </Form.Item>
        <Form.Item label="所属区域">
          <Select
            v-model:value="searchForm.regionCode"
            :options="regionOptions"
            allow-clear
            placeholder="选择所属区域"
          />
        </Form.Item>
        <div class="search-actions">
          <Button type="primary" class="flex-1" @click="handleSearch">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('common.search') }}
          </Button>
          <Button class="flex-1" @click="handleReset">
            {{ $t('common.reset') }}
          </Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('ui.loading')">
      <div v-if="list.length > 0">
        <Card
          v-for="item in list"
          :key="item.noticeId"
          class="notice-card"
          :body-style="{ padding: '0' }"
        >
          <div class="card-header">
            <span class="notice-title">
              {{ item.title }}
            </span>
          </div>

          <div class="card-content">
            <div class="info-list">
              <div v-if="item.owner" class="info-row">
                <span class="info-label">业主/单位</span>
                <span class="info-value">{{ item.owner }}</span>
              </div>
              <div v-if="item.date" class="info-row">
                <span class="info-label">发布时间</span>
                <span class="info-value">{{
                  formatPublishDate(item.date)
                }}</span>
              </div>
              <div v-if="resolveCityName(item)" class="info-row">
                <span class="info-label">所属区域</span>
                <span class="info-value">{{ resolveCityName(item) }}</span>
              </div>
              <div v-if="item.projectType" class="info-row">
                <span class="info-label">项目类型</span>
                <span class="info-value">{{ item.projectType }}</span>
              </div>
              <div v-if="item.category" class="info-row">
                <span class="info-label">分类</span>
                <span class="info-value">{{ item.category }} </span>
              </div>
            </div>

            <div class="card-actions">
              <Button
                size="middle"
                type="primary"
                class="jump-button"
                :disabled="!item.link"
                @click="openNoticeLink(item.link)"
              >
                查看详情
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Pagination
        v-if="pagination.total > pagination.pageSize"
        v-model:current="pagination.current"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        @change="handlePageChange"
        size="small"
        class="list-pagination"
      />

      <Empty
        v-if="listIsEmpty"
        class="py-10"
        :description="$t('page.finance.noData')"
      />
    </Spin>
  </div>
</template>

<style scoped>
.notices-mobile-page {
  box-sizing: border-box;
  padding: 8px;
  background-color: #f0f2f5;
}

.dark .notices-mobile-page {
  background-color: #1a1a1a;
}

.search-filters {
  padding: 12px 8px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.dark .search-filters {
  background-color: #2d2d2d;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.flex-1 {
  flex: 1;
}

.notice-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .notice-card {
  background-color: #2d2d2d;
}

.card-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.notice-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
  white-space: normal;
}

.card-actions {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.jump-button {
  flex: 0 0 auto;
  min-width: 128px;
}

.card-content {
  padding: 16px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.info-label {
  flex: 0 0 76px;
  margin-bottom: 0;
  font-size: 14px;
  color: #969799;
  white-space: nowrap;
}

.info-label::after {
  content: '：';
}

.dark .info-label {
  color: #a0a0a0;
}

.info-value {
  flex: 1;
  font-size: 14px;
  color: #323233;
  text-align: left;
  word-break: break-word;
  white-space: normal;
}

.dark .info-value {
  color: #e0e0e0;
}

.link-tip {
  display: inline-block;
  margin-top: 10px;
}

.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
}
</style>
