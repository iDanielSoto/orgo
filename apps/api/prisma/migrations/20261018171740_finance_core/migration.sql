-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'DEBIT', 'SAVINGS', 'WALLET', 'CREDIT');

-- CreateEnum
CREATE TYPE "BudgetBucket" AS ENUM ('SAVINGS', 'FIXED', 'FUN', 'NONE');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('SALARY', 'SCHOLARSHIP', 'PRIZE', 'SALE', 'FREELANCE', 'GIFT', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('PLANNED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "openedOn" DATE NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "defaultBucket" "BudgetBucket" NOT NULL DEFAULT 'FIXED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "savingsBp" INTEGER NOT NULL,
    "fixedBp" INTEGER NOT NULL,
    "funBp" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER,
    "type" "IncomeType" NOT NULL DEFAULT 'OTHER',
    "frequency" "Frequency" NOT NULL DEFAULT 'ONCE',
    "status" "IncomeStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedOn" DATE,
    "receivedOn" DATE,
    "accountId" UUID,
    "savingsBpOverride" INTEGER,
    "fixedBpOverride" INTEGER,
    "funBpOverride" INTEGER,
    "allocSavingsCents" INTEGER,
    "allocFixedCents" INTEGER,
    "allocFunCents" INTEGER,
    "notes" TEXT,
    "importRowId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "accountId" UUID,
    "toAccountId" UUID,
    "concept" TEXT NOT NULL,
    "categoryId" UUID,
    "bucket" "BudgetBucket" NOT NULL DEFAULT 'NONE',
    "incomeId" UUID,
    "notes" TEXT,
    "importRowId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetTransfer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "fromBucket" "BudgetBucket" NOT NULL,
    "toBucket" "BudgetBucket" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "sheet" TEXT NOT NULL,
    "cellRef" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_idx" ON "FinancialAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_userId_name_key" ON "FinanceCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "BudgetRule_userId_effectiveFrom_idx" ON "BudgetRule"("userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Income_importRowId_key" ON "Income"("importRowId");

-- CreateIndex
CREATE INDEX "Income_userId_status_idx" ON "Income"("userId", "status");

-- CreateIndex
CREATE INDEX "Income_userId_receivedOn_idx" ON "Income"("userId", "receivedOn");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_incomeId_key" ON "Transaction"("incomeId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_importRowId_key" ON "Transaction"("importRowId");

-- CreateIndex
CREATE INDEX "Transaction_userId_localDate_idx" ON "Transaction"("userId", "localDate");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_toAccountId_idx" ON "Transaction"("toAccountId");

-- CreateIndex
CREATE INDEX "BudgetTransfer_userId_month_idx" ON "BudgetTransfer"("userId", "month");

-- CreateIndex
CREATE INDEX "ImportBatch_userId_idx" ON "ImportBatch"("userId");

-- CreateIndex
CREATE INDEX "ImportRow_rowHash_idx" ON "ImportRow"("rowHash");

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRule" ADD CONSTRAINT "BudgetRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetTransfer" ADD CONSTRAINT "BudgetTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
