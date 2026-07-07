-- CreateTable
CREATE TABLE "wiki_species" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "latin_name" VARCHAR(120),
    "family" VARCHAR(80),
    "description" TEXT,
    "image_url" TEXT,
    "wikipedia_url" TEXT,
    "common_weight_max_kg" DECIMAL(65,30),
    "trophy_weight_max_kg" DECIMAL(65,30),
    "unique_weight_max_kg" DECIMAL(65,30),
    "common_credits_per_kg" INTEGER,
    "trophy_credits_per_kg" INTEGER,
    "unique_credits_per_kg" INTEGER,
    "hook_size_min" VARCHAR(10),
    "hook_size_max" VARCHAR(10),
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_species_baits" (
    "id" SERIAL NOT NULL,
    "species_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,

    CONSTRAINT "wiki_species_baits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_species_lures" (
    "id" SERIAL NOT NULL,
    "species_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,

    CONSTRAINT "wiki_species_lures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_species_locations" (
    "id" SERIAL NOT NULL,
    "species_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,

    CONSTRAINT "wiki_species_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_brands" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "source_url" TEXT,
    "content_hash" VARCHAR(64),
    "scraped_at" TIMESTAMP(3),

    CONSTRAINT "wiki_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_technologies" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(30),

    CONSTRAINT "wiki_technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_reels" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(30) NOT NULL,
    "brand_id" INTEGER,
    "description" TEXT,
    "image_url" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_reels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_reel_variants" (
    "id" SERIAL NOT NULL,
    "reel_id" INTEGER NOT NULL,
    "spool_size" VARCHAR(30),
    "gear_ratio" VARCHAR(20),
    "retrieve_cm" DECIMAL(65,30),
    "max_drag_kg" DECIMAL(65,30),
    "ball_bearings" VARCHAR(20),
    "weight_g" DECIMAL(65,30),
    "line_capacity" VARCHAR(60),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "unlock_level" INTEGER,

    CONSTRAINT "wiki_reel_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_reel_technologies" (
    "reel_id" INTEGER NOT NULL,
    "technology_id" INTEGER NOT NULL,

    CONSTRAINT "wiki_reel_technologies_pkey" PRIMARY KEY ("reel_id","technology_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_species_slug_key" ON "wiki_species"("slug");

-- CreateIndex
CREATE INDEX "wiki_species_baits_species_id_idx" ON "wiki_species_baits"("species_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_species_baits_species_id_name_key" ON "wiki_species_baits"("species_id", "name");

-- CreateIndex
CREATE INDEX "wiki_species_lures_species_id_idx" ON "wiki_species_lures"("species_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_species_lures_species_id_name_key" ON "wiki_species_lures"("species_id", "name");

-- CreateIndex
CREATE INDEX "wiki_species_locations_species_id_idx" ON "wiki_species_locations"("species_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_species_locations_species_id_name_key" ON "wiki_species_locations"("species_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_brands_slug_key" ON "wiki_brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_technologies_slug_key" ON "wiki_technologies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_reels_slug_key" ON "wiki_reels"("slug");

-- CreateIndex
CREATE INDEX "wiki_reels_brand_id_idx" ON "wiki_reels"("brand_id");

-- CreateIndex
CREATE INDEX "wiki_reel_variants_reel_id_idx" ON "wiki_reel_variants"("reel_id");

-- CreateIndex
CREATE INDEX "wiki_reel_technologies_technology_id_idx" ON "wiki_reel_technologies"("technology_id");

-- AddForeignKey
ALTER TABLE "wiki_species_baits" ADD CONSTRAINT "wiki_species_baits_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "wiki_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_species_lures" ADD CONSTRAINT "wiki_species_lures_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "wiki_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_species_locations" ADD CONSTRAINT "wiki_species_locations_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "wiki_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_reels" ADD CONSTRAINT "wiki_reels_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "wiki_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_reel_variants" ADD CONSTRAINT "wiki_reel_variants_reel_id_fkey" FOREIGN KEY ("reel_id") REFERENCES "wiki_reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_reel_technologies" ADD CONSTRAINT "wiki_reel_technologies_reel_id_fkey" FOREIGN KEY ("reel_id") REFERENCES "wiki_reels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_reel_technologies" ADD CONSTRAINT "wiki_reel_technologies_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "wiki_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

