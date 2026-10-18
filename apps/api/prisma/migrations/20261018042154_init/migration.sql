-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "NutritionMode" AS ENUM ('SIMPLE', 'DETAILED');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('TRAINING', 'WEEKLY_REVIEW', 'WEIGH_IN', 'BEDTIME', 'HYDRATION');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('WEIGHT', 'STRENGTH', 'ACTIVITY', 'WATER', 'SODA', 'SLEEP', 'CONSISTENCY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NutritionSource" AS ENUM ('USER', 'APPROXIMATION', 'REFERENCE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "PortionSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "BeverageType" AS ENUM ('WATER', 'SODA_REGULAR', 'SODA_ZERO', 'JUICE', 'COFFEE', 'TEA', 'OTHER');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "HabitFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "HabitAutoRule" AS ENUM ('NONE', 'SCHEDULED_ACTIVITY', 'SODA_LIMIT', 'WATER_GOAL', 'PROTEIN_MEALS', 'SLEEP_WINDOW', 'WEEKLY_WEIGH_IN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "ageYears" INTEGER NOT NULL,
    "ageRecordedOn" DATE NOT NULL,
    "sexForEstimates" "Sex" NOT NULL,
    "heightCm" DECIMAL(5,1) NOT NULL,
    "startWeightKg" DECIMAL(5,2) NOT NULL,
    "targetWeightKg" DECIMAL(5,2) NOT NULL,
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'SEDENTARY',
    "primaryGoal" TEXT NOT NULL,
    "secondaryGoals" TEXT[],
    "trainingLocation" TEXT,
    "equipment" TEXT[],
    "trainingDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 30,
    "preferredTrainingTime" TEXT,
    "programStartDate" DATE NOT NULL,
    "firstReviewDate" DATE NOT NULL,
    "obstacles" TEXT[],
    "onboardingCompletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conditions" TEXT[],
    "medications" TEXT[],
    "physicalLimitations" TEXT[],
    "symptoms" TEXT[],
    "dailyActivity" TEXT,
    "currentExercise" TEXT,
    "physicalCapacity" TEXT,
    "dietSummary" TEXT,
    "foodPreferences" TEXT,
    "weeklyExtraBudgetMxn" DECIMAL(10,2),
    "usualBedtime" TEXT,
    "usualWakeTime" TEXT,
    "usualSleepHours" DECIMAL(4,2),
    "sleepQuality" TEXT,
    "stressLevel" TEXT,
    "lifestyleNotes" TEXT,
    "snoringReported" BOOLEAN NOT NULL DEFAULT false,
    "breathingPausesReported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "locale" TEXT NOT NULL DEFAULT 'es-MX',
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "nutritionMode" "NutritionMode" NOT NULL DEFAULT 'SIMPLE',
    "glassSizeMl" INTEGER NOT NULL DEFAULT 355,
    "sodaBaselineGlasses" DECIMAL(4,1),
    "energyTargetMinKcal" INTEGER NOT NULL DEFAULT 2000,
    "energyTargetMaxKcal" INTEGER NOT NULL DEFAULT 2200,
    "proteinTargetMinG" INTEGER NOT NULL DEFAULT 110,
    "proteinTargetMaxG" INTEGER NOT NULL DEFAULT 140,
    "sleepTargetMinHours" DECIMAL(3,1) NOT NULL DEFAULT 7,
    "sleepTargetMaxHours" DECIMAL(3,1) NOT NULL DEFAULT 9,
    "targetBedtime" TEXT NOT NULL DEFAULT '02:00',
    "targetWakeTime" TEXT NOT NULL DEFAULT '09:30',
    "trainingTime" TEXT NOT NULL DEFAULT '10:00',
    "retentionDays" INTEGER,
    "analyticsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "aiDataSharingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timeOfDay" TEXT,
    "weekdays" INTEGER[],
    "intervalMinutes" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "GoalCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "targetValue" DECIMAL(10,2),
    "unit" TEXT,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "achievedAt" TIMESTAMPTZ(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "weightKg" DECIMAL(5,2),
    "waistCm" DECIMAL(5,1),
    "hipCm" DECIMAL(5,1),
    "chestCm" DECIMAL(5,1),
    "armCm" DECIMAL(5,1),
    "thighCm" DECIMAL(5,1),
    "neckCm" DECIMAL(5,1),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressPhoto" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pose" TEXT,
    "takenAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "servingLabel" TEXT NOT NULL,
    "servingGrams" DECIMAL(7,1),
    "kcal" DECIMAL(7,1),
    "proteinG" DECIMAL(6,1),
    "carbsG" DECIMAL(6,1),
    "fatG" DECIMAL(6,1),
    "source" "NutritionSource" NOT NULL DEFAULT 'APPROXIMATION',
    "sourceNote" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "MealType" NOT NULL,
    "eatenAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "portion" "PortionSize",
    "proteinSource" TEXT,
    "hasFruit" BOOLEAN NOT NULL DEFAULT false,
    "hasVegetables" BOOLEAN NOT NULL DEFAULT false,
    "hungerBefore" INTEGER,
    "note" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" UUID NOT NULL,
    "mealId" UUID NOT NULL,
    "foodId" UUID,
    "name" TEXT NOT NULL,
    "servings" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "kcal" DECIMAL(7,1),
    "proteinG" DECIMAL(6,1),
    "carbsG" DECIMAL(6,1),
    "fatG" DECIMAL(6,1),

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeverageLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "BeverageType" NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "loggedAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BeverageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HydrationGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "waterMl" INTEGER NOT NULL,
    "sodaMaxGlasses" INTEGER,

    CONSTRAINT "HydrationGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT[],
    "cues" TEXT[],
    "perSide" BOOLEAN NOT NULL DEFAULT false,
    "equipment" TEXT,
    "mediaUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warmup" TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateExercise" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "repsMin" INTEGER NOT NULL,
    "repsMax" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "WorkoutTemplateExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "templateId" UUID,
    "routineCode" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'COMPLETED',
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "localDate" DATE NOT NULL,
    "durationMinutes" INTEGER,
    "perceivedEffort" INTEGER,
    "pain" BOOLEAN NOT NULL DEFAULT false,
    "excessiveFatigue" BOOLEAN NOT NULL DEFAULT false,
    "poorRecovery" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "side" TEXT,
    "completedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalkingSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "perceivedEffort" INTEGER,
    "includedMobility" BOOLEAN NOT NULL DEFAULT true,
    "pain" BOOLEAN NOT NULL DEFAULT false,
    "excessiveFatigue" BOOLEAN NOT NULL DEFAULT false,
    "poorRecovery" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WalkingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bedtime" TIMESTAMPTZ(3) NOT NULL,
    "wakeTime" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "quality" INTEGER,
    "energy" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SleepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "HabitFrequency" NOT NULL DEFAULT 'DAILY',
    "autoRule" "HabitAutoRule" NOT NULL DEFAULT 'NONE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitCompletion" (
    "id" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodDate" DATE NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "weightKg" DECIMAL(5,2),
    "energy" INTEGER,
    "sleepQuality" INTEGER,
    "hunger" INTEGER,
    "trainingDifficulty" INTEGER,
    "sodaPerception" INTEGER,
    "hydrationPerception" INTEGER,
    "obstacles" TEXT,
    "overallFeeling" INTEGER,
    "summary" JSONB,
    "recommendations" JSONB,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthProfile_userId_key" ON "HealthProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_kind_key" ON "NotificationPreference"("userId", "kind");

-- CreateIndex
CREATE INDEX "Goal_userId_category_idx" ON "Goal"("userId", "category");

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_localDate_idx" ON "BodyMeasurement"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressPhoto_storageKey_key" ON "ProgressPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "ProgressPhoto_userId_localDate_idx" ON "ProgressPhoto"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Food_userId_name_key" ON "Food"("userId", "name");

-- CreateIndex
CREATE INDEX "Meal_userId_localDate_idx" ON "Meal"("userId", "localDate");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "BeverageLog_userId_localDate_idx" ON "BeverageLog"("userId", "localDate");

-- CreateIndex
CREATE INDEX "BeverageLog_userId_type_localDate_idx" ON "BeverageLog"("userId", "type", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "HydrationGoal_userId_weekNumber_key" ON "HydrationGoal"("userId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_userId_slug_key" ON "Exercise"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplate_userId_code_key" ON "WorkoutTemplate"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplateExercise_templateId_position_key" ON "WorkoutTemplateExercise"("templateId", "position");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_localDate_idx" ON "WorkoutSession"("userId", "localDate");

-- CreateIndex
CREATE INDEX "ExerciseSet_sessionId_idx" ON "ExerciseSet"("sessionId");

-- CreateIndex
CREATE INDEX "WalkingSession_userId_localDate_idx" ON "WalkingSession"("userId", "localDate");

-- CreateIndex
CREATE INDEX "SleepLog_userId_localDate_idx" ON "SleepLog"("userId", "localDate");

-- CreateIndex
CREATE INDEX "Habit_userId_archivedAt_idx" ON "Habit"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "HabitCompletion_userId_periodDate_idx" ON "HabitCompletion"("userId", "periodDate");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCompletion_habitId_periodDate_key" ON "HabitCompletion"("habitId", "periodDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekNumber_key" ON "WeeklyReview"("userId", "weekNumber");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeverageLog" ADD CONSTRAINT "BeverageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HydrationGoal" ADD CONSTRAINT "HydrationGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkingSession" ADD CONSTRAINT "WalkingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepLog" ADD CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
