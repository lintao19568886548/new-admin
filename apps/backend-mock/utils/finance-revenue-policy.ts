export const AUTO_RENTAL_EXPENSE_BILL_NAME = '租金支出';
export const AUTO_RENTAL_EXPENSE_BILL_CATEGORY = '其他费用';

export const AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE = {
  billCategory: AUTO_RENTAL_EXPENSE_BILL_CATEGORY,
  billName: AUTO_RENTAL_EXPENSE_BILL_NAME,
  transactionType: '支出',
};

export function isAutoRentalExpenseFinanceRecord(
  record: Record<string, unknown>,
) {
  return (
    record.billCategory === AUTO_RENTAL_EXPENSE_BILL_CATEGORY &&
    record.billName === AUTO_RENTAL_EXPENSE_BILL_NAME &&
    record.transactionType === '支出'
  );
}
