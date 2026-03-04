export const BAIDU_MAP_AK = 'V3MEar3oaE0GJ81jp5StYmyiQz4I5LDT';

export const REIMBURSEMENT_NOTIFY_THRESHOLD = Number(
  (import.meta as any).env.VITE_REIMBURSEMENT_NOTIFY_THRESHOLD ?? 50_000,
);

export const CHAIRMAN_ROLE_NAMES = String(
  (import.meta as any).env.VITE_CHAIRMAN_ROLE_NAMES ?? '董事长,Chairman',
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
