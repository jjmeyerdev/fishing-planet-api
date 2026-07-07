-- CreateTable
CREATE TABLE "wiki_groundbaits" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "brand" VARCHAR(80),
    "description" TEXT,
    "target_fish" TEXT[],
    "temperature" VARCHAR(80),
    "aroma" VARCHAR(120),
    "effect" VARCHAR(60),
    "contains" VARCHAR(120),
    "flavour" VARCHAR(80),
    "color" VARCHAR(80),
    "grain" VARCHAR(40),
    "density" VARCHAR(40),
    "ponds" VARCHAR(120),
    "nutrition_value" VARCHAR(40),
    "size_mm" VARCHAR(20),
    "weight" VARCHAR(30),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "unlock_level" INTEGER,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_groundbaits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_groundbaits_slug_key" ON "wiki_groundbaits"("slug");

