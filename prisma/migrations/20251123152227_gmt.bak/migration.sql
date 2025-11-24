-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GRANTS_OFFICER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "FunderType" AS ENUM ('PUBLIC', 'PHILANTHROPIC', 'PRIVATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('OPEN', 'INVITED', 'ROLLING', 'STAGED');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('TRIAGE', 'PREP', 'REVIEW', 'SUBMIT', 'AWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationOutcome" AS ENUM ('UNKNOWN', 'AWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('BOILERPLATE_1LINE', 'BOILERPLATE_1PARA', 'BOILERPLATE_1PAGE', 'OUTREACH', 'BUDGET');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('BUDGET', 'DRAFT', 'SUPPORTING', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendedAction" AS ENUM ('PURSUE', 'MONITOR', 'NO_GO');

-- CreateEnum
CREATE TYPE "RecordVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'SCORE_RUN', 'SCORE_OVERRIDE', 'LOGIN', 'EXPORT_GENERATED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('OPPORTUNITY_IMPORT_CSV', 'SCORING_RUN', 'HARVEST_RUN', 'EXPORT_PACKAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funders" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FunderType" NOT NULL,
    "website_url" TEXT,
    "description" TEXT,
    "geographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "funders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "funder_id" UUID NOT NULL,
    "program_name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "last_fetched" TIMESTAMPTZ,
    "declared_focus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explicit_exclusions" TEXT,
    "geographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligible_applicant_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_award" DECIMAL(14,2),
    "max_award" DECIMAL(14,2),
    "currency" TEXT,
    "duration_months" INTEGER,
    "application_type" "ApplicationType" NOT NULL,
    "deadlines" JSONB NOT NULL DEFAULT '[]',
    "reporting_requirements" TEXT,
    "process_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw_description" TEXT,
    "ai_fit_score" DECIMAL(3,1),
    "ai_fit_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_recommended_action" "RecommendedAction",
    "ai_confidence" DECIMAL(3,2),
    "manual_fit_score" DECIMAL(3,1),
    "manual_recommended_action" "RecommendedAction",
    "manual_fit_rationale" TEXT,
    "visibility" "RecordVisibility" NOT NULL DEFAULT 'INTERNAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "funder_id" UUID,
    "opportunity_id" UUID,
    "name" TEXT NOT NULL,
    "role_title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "lead_owner_id" UUID NOT NULL,
    "stage" "ApplicationStage" NOT NULL,
    "outcome" "ApplicationOutcome" NOT NULL DEFAULT 'UNKNOWN',
    "expected_award_amount" DECIMAL(14,2),
    "expected_currency" TEXT,
    "award_amount" DECIMAL(14,2),
    "award_currency" TEXT,
    "ai_fit_score_snapshot" DECIMAL(3,1),
    "ai_fit_reasons_snapshot" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_tasks" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "category" TEXT NOT NULL,
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "application_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_reviews" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "estimated_staff_hours" DECIMAL(5,2),
    "requires_director_signoff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_usages" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "used_by_id" UUID NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "funder_id" UUID,
    "opportunity_id" UUID,
    "application_id" UUID,
    "category" "AttachmentCategory" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "csv_attachment_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "contact_id" UUID,
    "interaction_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_scoring_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "weight_alignment" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "weight_geography" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "weight_applicant_type" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "weight_award_size" DECIMAL(3,2) NOT NULL DEFAULT 0.1,
    "threshold_high" DECIMAL(3,1) NOT NULL DEFAULT 7.0,
    "threshold_medium" DECIMAL(3,1) NOT NULL DEFAULT 4.0,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "fit_scoring_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_rules" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "allowed_geographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_applicant_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_award_amount" DECIMAL(14,2),
    "max_award_amount" DECIMAL(14,2),
    "currency" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "embedding" vector,
    "model_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "file_attachment_id" UUID,
    "created_by_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cron_schedule" TEXT NOT NULL DEFAULT '0 3 * * *',
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMPTZ,
    "last_success_at" TIMESTAMPTZ,

    CONSTRAINT "harvest_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditActionType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "funders_name_idx" ON "funders" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "funders_tags_idx" ON "funders" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "opportunities_funder_id_idx" ON "opportunities"("funder_id");

-- CreateIndex
CREATE INDEX "opportunities_ai_fit_score_idx" ON "opportunities"("ai_fit_score");

-- CreateIndex
CREATE INDEX "opportunities_tags_idx" ON "opportunities" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "applications_stage_idx" ON "applications"("stage");

-- CreateIndex
CREATE INDEX "applications_lead_owner_id_idx" ON "applications"("lead_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_application_id_key" ON "budgets"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_csv_attachment_id_key" ON "budgets"("csv_attachment_id");

-- AddForeignKey
ALTER TABLE "funders" ADD CONSTRAINT "funders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_lead_owner_id_fkey" FOREIGN KEY ("lead_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_tasks" ADD CONSTRAINT "application_tasks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_tasks" ADD CONSTRAINT "application_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_usages" ADD CONSTRAINT "template_usages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_usages" ADD CONSTRAINT "template_usages_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_usages" ADD CONSTRAINT "template_usages_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_funder_id_fkey" FOREIGN KEY ("funder_id") REFERENCES "funders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_csv_attachment_id_fkey" FOREIGN KEY ("csv_attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_scoring_config" ADD CONSTRAINT "fit_scoring_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_file_attachment_id_fkey" FOREIGN KEY ("file_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
