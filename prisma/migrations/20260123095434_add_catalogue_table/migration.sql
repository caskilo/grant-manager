-- CreateTable
CREATE TABLE "catalogue" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "focus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website_url" TEXT NOT NULL,
    "typical_award_min" DECIMAL(14,2),
    "typical_award_max" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "open_data" TEXT NOT NULL DEFAULT 'No',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "catalogue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalogue_name_idx" ON "catalogue" USING GIN ("name" gin_trgm_ops);
