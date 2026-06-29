<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type {
  CreateOrganizationInvitationPayload,
  OrganizationInvitation,
} from '#/api/organization-invitation';
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createOrganizationInvitationApi,
  listOrganizationInvitationsApi,
  revokeOrganizationInvitationApi,
} from '#/api/organization-invitation';
import { getRoleList } from '#/api/system/role';

defineOptions({ name: 'ProfileOrganizationInvitations' });

const router = useRouter();
const userStore = useUserStore();

const userInfo = computed(() => userStore.userInfo as any);
const currentCustomerId = computed(() =>
  String(userInfo.value?.customerId || ''),
);
const currentUserRoles = computed(() => {
  const roles = userInfo.value?.roles;
  return Array.isArray(roles) ? roles.map(String) : [];
});
const canManageOrganizationInvitations = computed(
  () =>
    Boolean(currentCustomerId.value) &&
    !['default', 'public'].includes(currentCustomerId.value),
);
const currentCenterUserId = computed(() =>
  Number(userInfo.value?.centerUserId || userInfo.value?.id || 0),
);

const loading = ref(false);
const creating = ref(false);
const loaded = ref(false);
const invitations = ref<OrganizationInvitation[]>([]);
const roles = ref<SystemRoleApi.SystemRole[]>([]);
const selectedRoleIds = ref<number[]>([]);
const maxUses = ref<number>();
const expiresAt = ref<Dayjs>();
const remark = ref('');
const revokingInvitationId = ref<null | number>(null);

const activeInvitationCount = computed(
  () =>
    invitations.value.filter(
      (invitation) => getInvitationState(invitation).status === 'active',
    ).length,
);
const roleOptions = computed(() =>
  roles.value
    .filter((role) => isRoleEnabled(role))
    .map((role) => ({
      label: role.name || `角色 ${role.roleId}`,
      value: Number(role.roleId),
    })),
);
const roleNameMap = computed(() => {
  const map = new Map<number, string>();
  for (const role of roles.value) {
    map.set(Number(role.roleId), role.name || `角色 ${role.roleId}`);
  }
  return map;
});

function flattenRoles(items: SystemRoleApi.SystemRole[] = []) {
  const result: SystemRoleApi.SystemRole[] = [];
  const visit = (role: SystemRoleApi.SystemRole) => {
    result.push(role);
    role.children?.forEach((child) => visit(child));
  };
  items.forEach((item) => visit(item));
  return result;
}

function normalizeRoleResponse(
  response:
    | SystemRoleApi.SystemRole[]
    | { items: SystemRoleApi.SystemRole[]; total: number },
) {
  return Array.isArray(response) ? response : response.items;
}

function isRoleEnabled(role: SystemRoleApi.SystemRole) {
  return role.status === true || Number(role.status) === 1;
}

function getInvitationState(invitation: OrganizationInvitation) {
  if (invitation.status === 'revoked') {
    return { color: 'default', label: '已撤销', status: 'revoked' };
  }
  if (invitation.expiresAt && dayjs(invitation.expiresAt).isBefore(dayjs())) {
    return { color: 'warning', label: '已过期', status: 'expired' };
  }
  if (
    invitation.maxUses !== null &&
    Number(invitation.usedCount) >= Number(invitation.maxUses)
  ) {
    return { color: 'default', label: '已用完', status: 'exhausted' };
  }
  return { color: 'success', label: '可使用', status: 'active' };
}

function formatDate(value: null | string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '长期有效';
}

function formatMaxUses(invitation: OrganizationInvitation) {
  if (invitation.maxUses === null) {
    return `${invitation.usedCount} / 不限`;
  }
  return `${invitation.usedCount} / ${invitation.maxUses}`;
}

function formatRoles(roleIds: number[]) {
  if (roleIds.length === 0) {
    return '默认成员角色';
  }
  return roleIds
    .map((roleId) => roleNameMap.value.get(Number(roleId)) || `#${roleId}`)
    .join('、');
}

function resetCreateForm() {
  selectedRoleIds.value = [];
  maxUses.value = undefined;
  expiresAt.value = undefined;
  remark.value = '';
}

async function loadPageData() {
  if (!canManageOrganizationInvitations.value) {
    return;
  }

  loading.value = true;
  try {
    const invitationResult = await listOrganizationInvitationsApi();
    invitations.value = invitationResult.items;
    try {
      const roleResult = await getRoleList();
      roles.value = flattenRoles(normalizeRoleResponse(roleResult));
    } catch (error) {
      console.warn('读取组织角色失败，创建邀请码将使用默认成员角色:', error);
      roles.value = [];
    }
    loaded.value = true;
  } catch (error) {
    console.error('读取企业邀请码数据失败:', error);
    message.error('读取企业邀请码数据失败');
  } finally {
    loading.value = false;
  }
}

async function handleCreateInvitation() {
  const payload: CreateOrganizationInvitationPayload = {};
  if (selectedRoleIds.value.length > 0) {
    payload.roleIds = selectedRoleIds.value;
  }
  if (maxUses.value !== undefined && maxUses.value !== null) {
    payload.maxUses = Number(maxUses.value);
  }
  if (expiresAt.value) {
    payload.expiresAt = expiresAt.value.toISOString();
  }
  if (remark.value.trim()) {
    payload.remark = remark.value.trim();
  }

  creating.value = true;
  try {
    const result = await createOrganizationInvitationApi(payload);
    message.success(`邀请码 ${result.invitation.code} 已创建`);
    resetCreateForm();
    await loadPageData();
  } catch (error) {
    console.error('创建企业邀请码失败:', error);
    message.error('创建企业邀请码失败');
  } finally {
    creating.value = false;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('邀请码已复制');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    message.success('邀请码已复制');
  }
}

function handleRevokeInvitation(invitation: OrganizationInvitation) {
  const isCreator =
    Number(invitation.createdByCenterUserId) === currentCenterUserId.value;
  if (!currentUserRoles.value.includes('Super') && !isCreator) {
    message.warning('只能撤销自己生成的邀请码');
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: `撤销后，邀请码 ${invitation.code} 将无法继续加入企业。`,
    okButtonProps: { danger: true },
    okText: '撤销邀请码',
    onOk: async () => {
      revokingInvitationId.value = invitation.id;
      try {
        await revokeOrganizationInvitationApi(invitation.id);
        message.success('邀请码已撤销');
        await loadPageData();
      } catch (error) {
        console.error('撤销企业邀请码失败:', error);
        message.error('撤销企业邀请码失败');
      } finally {
        revokingInvitationId.value = null;
      }
    },
    title: '确认撤销邀请码',
  });
}

function canRevokeInvitation(invitation: OrganizationInvitation) {
  return (
    currentUserRoles.value.includes('Super') ||
    Number(invitation.createdByCenterUserId) === currentCenterUserId.value
  );
}

function formatCreator(invitation: OrganizationInvitation) {
  return (
    invitation.createdBy?.name ||
    invitation.createdBy?.username ||
    `用户 #${invitation.createdByCenterUserId}`
  );
}

function getJoinLogState(
  log: NonNullable<OrganizationInvitation['joinLogs']>[number],
) {
  if (log.status === 'joined') {
    return { color: 'success', label: '已加入' };
  }
  return { color: 'error', label: '失败' };
}

function formatJoinLogTime(
  log: NonNullable<OrganizationInvitation['joinLogs']>[number],
) {
  return formatDate(log.joinedAt || log.updateTime || log.createTime);
}

function handleBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  void router.push({ name: 'Workbench' });
}

watch(
  canManageOrganizationInvitations,
  (canManage) => {
    if (canManage && !loaded.value) {
      void loadPageData();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="organization-invite-page">
    <div class="organization-invite-page__shell">
      <button
        class="organization-invite-page__back"
        type="button"
        @click="handleBack"
      >
        <VbenIcon icon="mdi:arrow-left" />
        返回首页
      </button>

      <section class="organization-invite-hero">
        <div>
          <p class="organization-invite-hero__eyebrow">
            Organization Invitation
          </p>
          <h1>组织邀请码</h1>
          <p class="organization-invite-hero__desc">
            为同一组织空间生成加入凭证，受邀用户填写邀请码后会进入当前组织空间。
          </p>
        </div>
        <div class="organization-invite-hero__stats">
          <span>可用邀请码</span>
          <strong>{{ activeInvitationCount }}</strong>
        </div>
      </section>

      <Card v-if="!canManageOrganizationInvitations" :bordered="false">
        <Empty description="当前账号还不能生成组织邀请码">
          <template #image>
            <VbenIcon icon="mdi:shield-lock-outline" class="empty-icon" />
          </template>
          <p class="organization-invite-page__empty-desc">
            请先创建或加入内部团队，进入组织空间后即可生成和查看邀请码。
          </p>
        </Empty>
      </Card>

      <Spin v-else :spinning="loading">
        <div class="organization-invite-layout">
          <Card :bordered="false" class="organization-invite-card">
            <template #title>创建邀请码</template>
            <div class="organization-invite-form">
              <label class="organization-invite-field">
                <span>加入后角色</span>
                <Select
                  v-model:value="selectedRoleIds"
                  :options="roleOptions"
                  mode="multiple"
                  option-filter-prop="label"
                  placeholder="可选；留空则使用默认成员角色"
                  show-search
                />
              </label>

              <div class="organization-invite-form__grid">
                <label class="organization-invite-field">
                  <span>最大使用次数</span>
                  <InputNumber
                    v-model:value="maxUses"
                    :min="1"
                    class="w-full"
                    placeholder="留空表示不限次数"
                  />
                </label>
                <label class="organization-invite-field">
                  <span>过期时间</span>
                  <DatePicker
                    v-model:value="expiresAt"
                    class="w-full"
                    placeholder="留空表示长期有效"
                    show-time
                  />
                </label>
              </div>

              <label class="organization-invite-field">
                <span>备注</span>
                <Input
                  v-model:value="remark"
                  :maxlength="200"
                  placeholder="例如：销售团队 4 月入职批次"
                  show-count
                />
              </label>

              <Button
                :loading="creating"
                block
                size="large"
                type="primary"
                @click="handleCreateInvitation"
              >
                生成邀请码
              </Button>
            </div>
          </Card>

          <Card :bordered="false" class="organization-invite-card">
            <template #title>使用规则</template>
            <div class="organization-invite-rules">
              <p>
                邀请码只属于当前组织空间，组织内登录用户均可生成；留空角色时使用默认成员角色。
              </p>
              <p>
                受邀用户必须在公开库；加入成功后会吊销旧登录态，重新登录后进入组织空间。
              </p>
              <p>已属于其他组织空间的账号不能通过邀请码直接加入。</p>
            </div>
          </Card>
        </div>

        <Card
          :bordered="false"
          class="organization-invite-card organization-invite-list"
        >
          <template #title>邀请码列表</template>
          <template #extra>
            <Button size="small" @click="loadPageData">刷新</Button>
          </template>

          <Empty v-if="invitations.length === 0" description="暂无邀请码" />
          <div v-else class="organization-invite-list__grid">
            <article
              v-for="invitation in invitations"
              :key="invitation.id"
              class="organization-invite-item"
            >
              <div class="organization-invite-item__head">
                <div>
                  <span class="organization-invite-item__code">
                    {{ invitation.code }}
                  </span>
                  <Tag :color="getInvitationState(invitation).color">
                    {{ getInvitationState(invitation).label }}
                  </Tag>
                </div>
                <Space>
                  <Button size="small" @click="copyText(invitation.code)">
                    复制
                  </Button>
                  <Button
                    v-if="
                      getInvitationState(invitation).status === 'active' &&
                      canRevokeInvitation(invitation)
                    "
                    :loading="revokingInvitationId === invitation.id"
                    danger
                    size="small"
                    @click="handleRevokeInvitation(invitation)"
                  >
                    撤销
                  </Button>
                </Space>
              </div>

              <dl class="organization-invite-item__meta">
                <div>
                  <dt>角色</dt>
                  <dd>{{ formatRoles(invitation.roleIds) }}</dd>
                </div>
                <div>
                  <dt>创建人</dt>
                  <dd>{{ formatCreator(invitation) }}</dd>
                </div>
                <div>
                  <dt>使用次数</dt>
                  <dd>{{ formatMaxUses(invitation) }}</dd>
                </div>
                <div>
                  <dt>过期时间</dt>
                  <dd>{{ formatDate(invitation.expiresAt) }}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{{ formatDate(invitation.createTime) }}</dd>
                </div>
              </dl>

              <p
                v-if="invitation.remark"
                class="organization-invite-item__remark"
              >
                {{ invitation.remark }}
              </p>

              <div class="organization-invite-usage">
                <div class="organization-invite-usage__head">
                  <strong>使用记录</strong>
                  <span>{{ invitation.joinLogs?.length || 0 }} 条</span>
                </div>
                <Empty
                  v-if="!invitation.joinLogs?.length"
                  description="暂无使用记录"
                  :image="Empty.PRESENTED_IMAGE_SIMPLE"
                />
                <div v-else class="organization-invite-usage__list">
                  <div
                    v-for="log in invitation.joinLogs"
                    :key="log.id"
                    class="organization-invite-usage__item"
                  >
                    <div>
                      <strong>{{ log.centerUserName }}</strong>
                      <span>
                        {{ log.centerUsername || `#${log.centerUserId}` }}
                      </span>
                    </div>
                    <div>
                      <Tag :color="getJoinLogState(log).color">
                        {{ getJoinLogState(log).label }}
                      </Tag>
                      <span>{{ formatJoinLogTime(log) }}</span>
                    </div>
                    <p v-if="log.errorMessage">
                      {{ log.errorMessage }}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </Card>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
.organization-invite-page {
  --invite-accent: #0f766e;
  --invite-accent-soft: rgb(15 118 110 / 12%);
  --invite-border: rgb(15 23 42 / 8%);
  --invite-card: rgb(255 255 255 / 94%);
  --invite-muted: #667085;
  --invite-text: #152238;

  min-height: 100%;
  padding: 24px;
  color: var(--invite-text);
  background:
    radial-gradient(circle at 12% 8%, rgb(20 184 166 / 18%), transparent 32%),
    radial-gradient(circle at 82% 0%, rgb(245 158 11 / 14%), transparent 30%),
    linear-gradient(180deg, #f5f7fb 0%, #eef4f2 52%, #fff 100%);
}

.organization-invite-page__shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.organization-invite-page__back {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 0;
  margin-bottom: 18px;
  color: var(--invite-text);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.organization-invite-page__empty-desc {
  max-width: 420px;
  margin: 12px auto 0;
  line-height: 1.8;
  color: var(--invite-muted);
}

.organization-invite-hero {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 28px;
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 96%), rgb(241 248 246 / 92%)),
    #fff;
  border: 1px solid var(--invite-border);
  border-radius: 28px;
  box-shadow: 0 16px 42px rgb(15 23 42 / 8%);
}

.organization-invite-hero__eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  color: var(--invite-accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.organization-invite-hero h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.1;
}

.organization-invite-hero__desc {
  max-width: 620px;
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.9;
  color: var(--invite-muted);
}

.organization-invite-hero__stats {
  min-width: 148px;
  padding: 18px;
  text-align: center;
  background: var(--invite-accent-soft);
  border: 1px solid rgb(15 118 110 / 16%);
  border-radius: 22px;
}

.organization-invite-hero__stats span {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--invite-muted);
}

.organization-invite-hero__stats strong {
  font-size: 34px;
  color: var(--invite-accent);
}

.organization-invite-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  gap: 18px;
  margin-bottom: 18px;
}

.organization-invite-card {
  overflow: hidden;
  background: var(--invite-card);
  border-radius: 24px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 5%);
}

.organization-invite-form,
.organization-invite-rules {
  display: grid;
  gap: 16px;
}

.organization-invite-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.organization-invite-field {
  display: grid;
  gap: 8px;
}

.organization-invite-field span {
  font-size: 13px;
  font-weight: 700;
}

.organization-invite-rules p {
  padding: 14px;
  margin: 0;
  line-height: 1.75;
  color: var(--invite-muted);
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--invite-border);
  border-radius: 16px;
}

.organization-invite-list {
  margin-bottom: 24px;
}

.organization-invite-list__grid {
  display: grid;
  gap: 14px;
}

.organization-invite-item {
  padding: 18px;
  background: linear-gradient(135deg, rgb(255 255 255 / 96%), #f8fbfb);
  border: 1px solid var(--invite-border);
  border-radius: 20px;
}

.organization-invite-item__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.organization-invite-item__code {
  display: inline-flex;
  padding: 8px 12px;
  margin-right: 8px;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 16px;
  font-weight: 800;
  color: var(--invite-accent);
  letter-spacing: 0.08em;
  background: var(--invite-accent-soft);
  border-radius: 999px;
}

.organization-invite-item__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}

.organization-invite-item__meta div {
  min-width: 0;
  padding: 12px;
  background: rgb(255 255 255 / 74%);
  border-radius: 14px;
}

.organization-invite-item__meta dt {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--invite-muted);
}

.organization-invite-item__meta dd {
  margin: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.organization-invite-item__remark {
  padding: 12px;
  margin: 14px 0 0;
  line-height: 1.7;
  color: var(--invite-muted);
  background: rgb(15 118 110 / 7%);
  border-radius: 14px;
}

.organization-invite-usage {
  padding: 14px;
  margin-top: 14px;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--invite-border);
  border-radius: 16px;
}

.organization-invite-usage__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.organization-invite-usage__head strong {
  color: var(--invite-text);
}

.organization-invite-usage__head span {
  font-size: 12px;
  color: var(--invite-muted);
}

.organization-invite-usage__list {
  display: grid;
  gap: 10px;
}

.organization-invite-usage__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px;
  background: rgb(248 250 252 / 84%);
  border-radius: 12px;
}

.organization-invite-usage__item > div {
  min-width: 0;
}

.organization-invite-usage__item strong,
.organization-invite-usage__item span {
  display: block;
  overflow-wrap: anywhere;
}

.organization-invite-usage__item span {
  margin-top: 4px;
  font-size: 12px;
  color: var(--invite-muted);
}

.organization-invite-usage__item > div:last-of-type {
  text-align: right;
}

.organization-invite-usage__item p {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #b42318;
}

.empty-icon {
  font-size: 72px;
  color: var(--invite-accent);
}

@media (max-width: 900px) {
  .organization-invite-page {
    padding: 16px;
  }

  .organization-invite-hero,
  .organization-invite-item__head {
    flex-direction: column;
    align-items: stretch;
  }

  .organization-invite-layout,
  .organization-invite-form__grid,
  .organization-invite-item__meta {
    grid-template-columns: 1fr;
  }

  .organization-invite-item__meta dd {
    white-space: normal;
  }

  .organization-invite-usage__item {
    grid-template-columns: 1fr;
  }

  .organization-invite-usage__item > div:last-of-type {
    text-align: left;
  }
}
</style>
