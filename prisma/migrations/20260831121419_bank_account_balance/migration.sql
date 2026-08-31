-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "balanceAsOf" TIMESTAMP(3),
ADD COLUMN     "currentBalance" DECIMAL(14,2);
