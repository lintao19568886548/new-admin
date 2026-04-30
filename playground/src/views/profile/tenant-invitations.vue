<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { SystemRoleApi } from '#/api/system/role';
import type {
  CreateTenantInvitationPayload,
  TenantInvitation,
} from '#/api/tenant-invitation';

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

import { getRoleList } from '#/api/system/role';
import {
  createTenantInvitationApi,
  listTenantInvitationsApi,
  revokeTenantInvitationApi,
} from '#/api/tenant-invitation';

defineOptions({ name: 'ProfileTenantInvitations' });

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
const canManageTenantInvitations = computed(
  () =>
    currentUserRoles.value.includes('Super') &&
    Boolean(currentCustomerId.value) &&
    !['default', 'public'].includes(currentCustomerId.value),
);

const loading = ref(false);
const creating = ref(false);
const loaded = ref(false);
const invitations = ref<TenantInvitation[]>([]);
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

function getInvitationState(invitation: TenantInvitation) {
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

function formatMaxUses(invitation: TenantInvitation) {
  if (invitation.maxUses === null) {
    return `${invitation.usedCount} / 不限`;
  }
  return `${invitation.usedCount} / ${invitation.maxUses}`;
}

function formatRoles(roleIds: number[]) {
  if (roleIds.length === 0) {
    return '未配置角色';
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
  if (!canManageTenantInvitations.value) {
    return;
  }

  loading.value = true;
  try {
    const [invitationResult, roleResult] = await Promise.all([
      listTenantInvitationsApi(),
      getRoleList(),
    ]);

    invitations.value = invitationResult.items;
    roles.value = flattenRoles(normalizeRoleResponse(roleResult));
    loaded.value = true;
  } catch (error) {
    console.error('读取企业邀请码数据失败:', error);
    message.error('读取企业邀请码数据失败');
  } finally {
    loading.value = false;
  }
}

async function handleCreateInvitation() {
  if (selectedRoleIds.value.length === 0) {
    message.warning('请至少选择一个加入后角色');
    return;
  }

  const payload: CreateTenantInvitationPayload = {
    roleIds: selectedRoleIds.value,
  };
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
    const result = await createTenantInvitationApi(payload);
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

function handleRevokeInvitation(invitation: TenantInvitation) {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: `撤销后，邀请码 ${invitation.code} 将无法继续加入企业。`,
    okButtonProps: { danger: true },
    okText: '撤销邀请码',
    onOk: async () => {
      revokingInvitationId.value = invitation.id;
      try {
        await revokeTenantInvitationApi(invitation.id);
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

function handleBack() {
  void router.push({ name: 'Profile' });
}

watch(
  canManageTenantInvitations,
  (canManage) => {
    if (canManage && !loaded.value) {
      void loadPageData();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="tenant-invite-page">
    <div class="tenant-invite-page__shell">
      <button
        class="tenant-invite-page__back"
        type="button"
        @click="handleBack"
      >
        <VbenIcon icon="mdi:arrow-left" />
        返回个人中心
      </button>

      <section class="tenant-invite-hero">
        <div>
          <p class="tenant-invite-hero__eyebrow">Tenant Invitation</p>
          <h1>企业邀请码</h1>
          <p class="tenant-invite-hero__desc">
            为同一企业租户生成加入凭证，受邀用户填写邀请码后会被切换到当前企业空间。
          </p>
        </div>
        <div class="tenant-invite-hero__stats">
          <span>可用邀请码</span>
          <strong>{{ activeInvitationCount }}</strong>
        </div>
      </section>

      <Card v-if="!canManageTenantInvitations" :bordered="false">
        <Empty description="当前账号不能管理企业邀请码">
          <template #image>
            <VbenIcon icon="mdi:shield-lock-outline" class="empty-icon" />
          </template>
          <p class="tenant-invite-page__empty-desc">
            只有专属租户内的 Super 角色账号可以创建、查看和撤销邀请码。
          </p>
        </Empty>
      </Card>

      <Spin v-else :spinning="loading">
        <div class="tenant-invite-layout">
          <Card :bordered="false" class="tenant-invite-card">
            <template #title>创建邀请码</template>
            <div class="tenant-invite-form">
              <label class="tenant-invite-field">
                <span>加入后角色</span>
                <Select
                  v-model:value="selectedRoleIds"
                  :options="roleOptions"
                  mode="multiple"
                  option-filter-prop="label"
                  placeholder="请选择受邀用户加入后的角色"
                  show-search
                />
              </label>

              <div class="tenant-invite-form__grid">
                <label class="tenant-invite-field">
                  <span>最大使用次数</span>
                  <InputNumber
                    v-model:value="maxUses"
                    :min="1"
                    class="w-full"
                    placeholder="留空表示不限次数"
                  />
                </label>
                <label class="tenant-invite-field">
                  <span>过期时间</span>
                  <DatePicker
                    v-model:value="expiresAt"
                    class="w-full"
                    placeholder="留空表示长期有效"
                    show-time
                  />
                </label>
              </div>

              <label class="tenant-invite-field">
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

          <Card :bordered="false" class="tenant-invite-card">
            <template #title>使用规则</template>
            <div class="tenant-invite-rules">
              <p>
                邀请码只属于当前企业租户，不会由支付建库自动生成，需要 Super
                角色主动创建。
              </p>
              <p>
                受邀用户必须在公开库；加入成功后会吊销旧登录态，重新登录后进入企业空间。
              </p>
              <p>已属于其他企业租户的账号不能通过邀请码直接加入。</p>
            </div>
          </Card>
        </div>

        <Card :bordered="false" class="tenant-invite-card tenant-invite-list">
          <template #title>邀请码列表</template>
          <template #extra>
            <Button size="small" @click="loadPageData">刷新</Button>
          </template>

          <Empty v-if="invitations.length === 0" description="暂无邀请码" />
          <div v-else class="tenant-invite-list__grid">
            <article
              v-for="invitation in invitations"
              :key="invitation.id"
              class="tenant-invite-item"
            >
              <div class="tenant-invite-item__head">
                <div>
                  <span class="tenant-invite-item__code">
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
                    v-if="getInvitationState(invitation).status === 'active'"
                    :loading="revokingInvitationId === invitation.id"
                    danger
                    size="small"
                    @click="handleRevokeInvitation(invitation)"
                  >
                    撤销
                  </Button>
                </Space>
              </div>

              <dl class="tenant-invite-item__meta">
                <div>
                  <dt>角色</dt>
                  <dd>{{ formatRoles(invitation.roleIds) }}</dd>
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

              <p v-if="invitation.remark" class="tenant-invite-item__remark">
                {{ invitation.remark }}
              </p>
            </article>
          </div>
        </Card>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
.tenant-invite-page {
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

.tenant-invite-page__shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.tenant-invite-page__back {
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

.tenant-invite-page__empty-desc {
  max-width: 420px;
  margin: 12px auto 0;
  line-height: 1.8;
  color: var(--invite-muted);
}

.tenant-invite-hero {
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

.tenant-invite-hero__eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  color: var(--invite-accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.tenant-invite-hero h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.1;
}

.tenant-invite-hero__desc {
  max-width: 620px;
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.9;
  color: var(--invite-muted);
}

.tenant-invite-hero__stats {
  min-width: 148px;
  padding: 18px;
  text-align: center;
  background: var(--invite-accent-soft);
  border: 1px solid rgb(15 118 110 / 16%);
  border-radius: 22px;
}

.tenant-invite-hero__stats span {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--invite-muted);
}

.tenant-invite-hero__stats strong {
  font-size: 34px;
  color: var(--invite-accent);
}

.tenant-invite-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  gap: 18px;
  margin-bottom: 18px;
}

.tenant-invite-card {
  overflow: hidden;
  background: var(--invite-card);
  border-radius: 24px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 5%);
}

.tenant-invite-form,
.tenant-invite-rules {
  display: grid;
  gap: 16px;
}

.tenant-invite-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.tenant-invite-field {
  display: grid;
  gap: 8px;
}

.tenant-invite-field span {
  font-size: 13px;
  font-weight: 700;
}

.tenant-invite-rules p {
  padding: 14px;
  margin: 0;
  line-height: 1.75;
  color: var(--invite-muted);
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--invite-border);
  border-radius: 16px;
}

.tenant-invite-list {
  margin-bottom: 24px;
}

.tenant-invite-list__grid {
  display: grid;
  gap: 14px;
}

.tenant-invite-item {
  padding: 18px;
  background: linear-gradient(135deg, rgb(255 255 255 / 96%), #f8fbfb);
  border: 1px solid var(--invite-border);
  border-radius: 20px;
}

.tenant-invite-item__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.tenant-invite-item__code {
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

.tenant-invite-item__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}

.tenant-invite-item__meta div {
  min-width: 0;
  padding: 12px;
  background: rgb(255 255 255 / 74%);
  border-radius: 14px;
}

.tenant-invite-item__meta dt {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--invite-muted);
}

.tenant-invite-item__meta dd {
  margin: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-invite-item__remark {
  padding: 12px;
  margin: 14px 0 0;
  line-height: 1.7;
  color: var(--invite-muted);
  background: rgb(15 118 110 / 7%);
  border-radius: 14px;
}

.empty-icon {
  font-size: 72px;
  color: var(--invite-accent);
}

@media (max-width: 900px) {
  .tenant-invite-page {
    padding: 16px;
  }

  .tenant-invite-hero,
  .tenant-invite-item__head {
    flex-direction: column;
    align-items: stretch;
  }

  .tenant-invite-layout,
  .tenant-invite-form__grid,
  .tenant-invite-item__meta {
    grid-template-columns: 1fr;
  }

  .tenant-invite-item__meta dd {
    white-space: normal;
  }
}
</style>
