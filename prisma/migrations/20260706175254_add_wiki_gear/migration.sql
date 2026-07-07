-- CreateTable
CREATE TABLE "wiki_rods" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "brand_id" INTEGER,
    "description" TEXT,
    "image_url" TEXT,
    "power" VARCHAR(40),
    "action" VARCHAR(40),
    "line_weight_lb" VARCHAR(40),
    "line_weight_kg" VARCHAR(40),
    "electric" BOOLEAN,
    "quiver_tips" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_rods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_rod_variants" (
    "id" SERIAL NOT NULL,
    "rod_id" INTEGER NOT NULL,
    "name" VARCHAR(120),
    "length_ft" VARCHAR(30),
    "length_m" VARCHAR(30),
    "lure_weight_oz" VARCHAR(40),
    "lure_weight_g" VARCHAR(40),
    "line_weight_lb" VARCHAR(40),
    "line_weight_kg" VARCHAR(40),
    "pieces" VARCHAR(20),
    "guides" VARCHAR(20),
    "unlock_level" INTEGER,
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "dlc_pack" TEXT,

    CONSTRAINT "wiki_rod_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_rod_technologies" (
    "rod_id" INTEGER NOT NULL,
    "technology_id" INTEGER NOT NULL,

    CONSTRAINT "wiki_rod_technologies_pkey" PRIMARY KEY ("rod_id","technology_id")
);

-- CreateTable
CREATE TABLE "wiki_lines" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "brand_id" INTEGER,
    "description" TEXT,
    "color" VARCHAR(60),
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_line_variants" (
    "id" SERIAL NOT NULL,
    "line_id" INTEGER NOT NULL,
    "diameter_mm" DECIMAL(65,30),
    "diameter_in" VARCHAR(20),
    "test_lb" VARCHAR(20),
    "test_kg" VARCHAR(20),
    "color" VARCHAR(60),
    "spool" VARCHAR(60),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "unlock_level" INTEGER,
    "image_url" TEXT,
    "fp_id" INTEGER,

    CONSTRAINT "wiki_line_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_hooks" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "brand_id" INTEGER,
    "type" VARCHAR(80),
    "color" VARCHAR(60),
    "sharpening" VARCHAR(40),
    "count" INTEGER,
    "description" TEXT,
    "image_url" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_hook_variants" (
    "id" SERIAL NOT NULL,
    "hook_id" INTEGER NOT NULL,
    "size" VARCHAR(20),
    "weight_oz" VARCHAR(30),
    "weight_g" DECIMAL(65,30),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "unlock_level" INTEGER,
    "image_url" TEXT,

    CONSTRAINT "wiki_hook_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_sinkers" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "brand_id" INTEGER,
    "description" TEXT,
    "image_url" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_sinkers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_sinker_variants" (
    "id" SERIAL NOT NULL,
    "sinker_id" INTEGER NOT NULL,
    "weight_g" DECIMAL(65,30),
    "weight_oz" VARCHAR(30),
    "capacity_kg" DECIMAL(65,30),
    "capacity_lb" VARCHAR(30),
    "form" VARCHAR(60),
    "count" INTEGER,
    "capacity" VARCHAR(30),
    "feeder_type" VARCHAR(60),
    "dissolution_time" VARCHAR(40),
    "variant_name" VARCHAR(120),
    "mesh" VARCHAR(40),
    "range" VARCHAR(40),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "unlock_level" INTEGER,
    "image_url" TEXT,

    CONSTRAINT "wiki_sinker_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_bobbers" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "section" VARCHAR(20),
    "fp_id" INTEGER,
    "image_url" TEXT,
    "description" TEXT,
    "color" VARCHAR(80),
    "size" VARCHAR(80),
    "shape" VARCHAR(40),
    "max_floating_weight" VARCHAR(20),
    "sensitivity" VARCHAR(20),
    "material" VARCHAR(80),
    "unlock_level" INTEGER,
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_bobbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_lures" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "description" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_lures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_lure_variants" (
    "id" SERIAL NOT NULL,
    "lure_id" INTEGER NOT NULL,
    "color" VARCHAR(80),
    "image_url" TEXT,
    "buoyancy" VARCHAR(20),
    "weight_g" DECIMAL(65,30),
    "length_cm" DECIMAL(65,30),
    "diving_depth_m" DECIMAL(65,30),
    "hook_size" VARCHAR(40),
    "quantity" INTEGER,
    "unlock_level" INTEGER,
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,

    CONSTRAINT "wiki_lure_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_rods_slug_key" ON "wiki_rods"("slug");

-- CreateIndex
CREATE INDEX "wiki_rods_brand_id_idx" ON "wiki_rods"("brand_id");

-- CreateIndex
CREATE INDEX "wiki_rod_variants_rod_id_idx" ON "wiki_rod_variants"("rod_id");

-- CreateIndex
CREATE INDEX "wiki_rod_technologies_technology_id_idx" ON "wiki_rod_technologies"("technology_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_lines_slug_key" ON "wiki_lines"("slug");

-- CreateIndex
CREATE INDEX "wiki_lines_brand_id_idx" ON "wiki_lines"("brand_id");

-- CreateIndex
CREATE INDEX "wiki_line_variants_line_id_idx" ON "wiki_line_variants"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_hooks_slug_key" ON "wiki_hooks"("slug");

-- CreateIndex
CREATE INDEX "wiki_hooks_brand_id_idx" ON "wiki_hooks"("brand_id");

-- CreateIndex
CREATE INDEX "wiki_hook_variants_hook_id_idx" ON "wiki_hook_variants"("hook_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_sinkers_slug_key" ON "wiki_sinkers"("slug");

-- CreateIndex
CREATE INDEX "wiki_sinkers_brand_id_idx" ON "wiki_sinkers"("brand_id");

-- CreateIndex
CREATE INDEX "wiki_sinker_variants_sinker_id_idx" ON "wiki_sinker_variants"("sinker_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_bobbers_slug_key" ON "wiki_bobbers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_lures_slug_key" ON "wiki_lures"("slug");

-- CreateIndex
CREATE INDEX "wiki_lure_variants_lure_id_idx" ON "wiki_lure_variants"("lure_id");

-- AddForeignKey
ALTER TABLE "wiki_rods" ADD CONSTRAINT "wiki_rods_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "wiki_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_rod_variants" ADD CONSTRAINT "wiki_rod_variants_rod_id_fkey" FOREIGN KEY ("rod_id") REFERENCES "wiki_rods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_rod_technologies" ADD CONSTRAINT "wiki_rod_technologies_rod_id_fkey" FOREIGN KEY ("rod_id") REFERENCES "wiki_rods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_rod_technologies" ADD CONSTRAINT "wiki_rod_technologies_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "wiki_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_lines" ADD CONSTRAINT "wiki_lines_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "wiki_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_line_variants" ADD CONSTRAINT "wiki_line_variants_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "wiki_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_hooks" ADD CONSTRAINT "wiki_hooks_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "wiki_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_hook_variants" ADD CONSTRAINT "wiki_hook_variants_hook_id_fkey" FOREIGN KEY ("hook_id") REFERENCES "wiki_hooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_sinkers" ADD CONSTRAINT "wiki_sinkers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "wiki_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_sinker_variants" ADD CONSTRAINT "wiki_sinker_variants_sinker_id_fkey" FOREIGN KEY ("sinker_id") REFERENCES "wiki_sinkers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_lure_variants" ADD CONSTRAINT "wiki_lure_variants_lure_id_fkey" FOREIGN KEY ("lure_id") REFERENCES "wiki_lures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

