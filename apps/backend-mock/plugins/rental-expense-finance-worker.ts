import { startRentalExpenseFinanceWorker } from '~/utils/rental-expense-finance';

export default defineNitroPlugin(() => {
  startRentalExpenseFinanceWorker();
});
