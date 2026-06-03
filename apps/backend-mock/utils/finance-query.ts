export function buildFinanceAmountWhere(amount: unknown) {
  const amountStr = String(amount ?? '').trim();
  if (!amountStr) {
    return undefined;
  }

  if (amountStr.startsWith('>=')) {
    return { gte: Number(amountStr.slice(2)) };
  }

  if (amountStr.startsWith('<=')) {
    return { lte: Number(amountStr.slice(2)) };
  }

  if (amountStr.startsWith('>')) {
    return { gt: Number(amountStr.slice(1)) };
  }

  if (amountStr.startsWith('<')) {
    return { lt: Number(amountStr.slice(1)) };
  }

  if (amountStr.includes('-')) {
    const [min, max] = amountStr.split('-').map(Number);
    return {
      gte: min,
      lte: max,
    };
  }

  return Number(amountStr);
}
