-- CreateTable
CREATE TABLE "wiki_baits" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "description" TEXT,
    "target_fish" TEXT[],
    "quantity" INTEGER,
    "weight_class" VARCHAR(20),
    "unlock_level" INTEGER,
    "hook_size" VARCHAR(40),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_baits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_boilies" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "boil_image_url" TEXT,
    "description" TEXT,
    "size_in" VARCHAR(20),
    "size_mm" VARCHAR(20),
    "target_fish" TEXT[],
    "flavour" VARCHAR(80),
    "color" VARCHAR(80),
    "buoyancy" VARCHAR(20),
    "weight_class" VARCHAR(20),
    "quantity" INTEGER,
    "unlock_level" INTEGER,
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_boilies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_baits_slug_key" ON "wiki_baits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_boilies_slug_key" ON "wiki_boilies"("slug");

