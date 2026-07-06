-- AlterTable
ALTER TABLE "fish" ADD COLUMN     "fp_id" INTEGER,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "slug" VARCHAR(120);

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "fp_id" INTEGER,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "slug" VARCHAR(120);

-- CreateTable
CREATE TABLE "spots" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "lat" DECIMAL(65,30) NOT NULL,
    "lng" DECIMAL(65,30) NOT NULL,
    "x" DECIMAL(65,30) NOT NULL,
    "y" DECIMAL(65,30) NOT NULL,
    "image_url" TEXT,
    "location_id" INTEGER NOT NULL,

    CONSTRAINT "spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weathers" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "value" VARCHAR(50) NOT NULL,
    "legacy_value" VARCHAR(20) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "icon_url" TEXT,
    "chart_url" TEXT,
    "location_id" INTEGER NOT NULL,

    CONSTRAINT "weathers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baits" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "bait_type" VARCHAR(50) NOT NULL,
    "tags" TEXT[],

    CONSTRAINT "baits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boilies" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "bait_type" VARCHAR(50) NOT NULL,
    "diameter_mm" INTEGER,
    "tags" TEXT[],

    CONSTRAINT "boilies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lure_types" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "tags" TEXT[],

    CONSTRAINT "lure_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lures" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "color" VARCHAR(50),
    "weight_g" DECIMAL(65,30),
    "length_cm" DECIMAL(65,30),
    "tags" TEXT[],
    "lure_type_id" INTEGER,

    CONSTRAINT "lures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hooks" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "size" VARCHAR(20) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "tags" TEXT[],

    CONSTRAINT "hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jigheads" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "size" VARCHAR(20) NOT NULL,
    "weight_g" DECIMAL(65,30),
    "color" VARCHAR(50),
    "tags" TEXT[],

    CONSTRAINT "jigheads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinkers" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "form" VARCHAR(50) NOT NULL,
    "weight_g" DECIMAL(65,30),
    "color" VARCHAR(50),
    "tags" TEXT[],

    CONSTRAINT "sinkers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keepnets" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "is_fish_friendly" BOOLEAN NOT NULL,

    CONSTRAINT "keepnets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addons" (
    "id" SERIAL NOT NULL,
    "fp_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "image_url" TEXT,
    "base_level" INTEGER NOT NULL,
    "baitcoin_level" INTEGER NOT NULL,
    "color" VARCHAR(50),
    "length_cm" DECIMAL(65,30),
    "tags" TEXT[],

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fish_baits" (
    "fish_id" INTEGER NOT NULL,
    "bait_id" INTEGER NOT NULL,

    CONSTRAINT "fish_baits_pkey" PRIMARY KEY ("fish_id","bait_id")
);

-- CreateTable
CREATE TABLE "fish_lure_types" (
    "fish_id" INTEGER NOT NULL,
    "lure_type_id" INTEGER NOT NULL,

    CONSTRAINT "fish_lure_types_pkey" PRIMARY KEY ("fish_id","lure_type_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spots_fp_id_key" ON "spots"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "spots_slug_key" ON "spots"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "weathers_fp_id_key" ON "weathers"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "weathers_slug_key" ON "weathers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "baits_fp_id_key" ON "baits"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "baits_slug_key" ON "baits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "boilies_fp_id_key" ON "boilies"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "boilies_slug_key" ON "boilies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lure_types_fp_id_key" ON "lure_types"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "lure_types_slug_key" ON "lure_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lures_fp_id_key" ON "lures"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "lures_slug_key" ON "lures"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "hooks_fp_id_key" ON "hooks"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "hooks_slug_key" ON "hooks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "jigheads_fp_id_key" ON "jigheads"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "jigheads_slug_key" ON "jigheads"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sinkers_fp_id_key" ON "sinkers"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "sinkers_slug_key" ON "sinkers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "keepnets_fp_id_key" ON "keepnets"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "keepnets_slug_key" ON "keepnets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "addons_fp_id_key" ON "addons"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "addons_slug_key" ON "addons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "fish_fp_id_key" ON "fish"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "fish_slug_key" ON "fish"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "locations_fp_id_key" ON "locations"("fp_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");

-- AddForeignKey
ALTER TABLE "spots" ADD CONSTRAINT "spots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weathers" ADD CONSTRAINT "weathers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lures" ADD CONSTRAINT "lures_lure_type_id_fkey" FOREIGN KEY ("lure_type_id") REFERENCES "lure_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fish_baits" ADD CONSTRAINT "fish_baits_fish_id_fkey" FOREIGN KEY ("fish_id") REFERENCES "fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fish_baits" ADD CONSTRAINT "fish_baits_bait_id_fkey" FOREIGN KEY ("bait_id") REFERENCES "baits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fish_lure_types" ADD CONSTRAINT "fish_lure_types_fish_id_fkey" FOREIGN KEY ("fish_id") REFERENCES "fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fish_lure_types" ADD CONSTRAINT "fish_lure_types_lure_type_id_fkey" FOREIGN KEY ("lure_type_id") REFERENCES "lure_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "lures_lure_type_id_idx" ON "lures"("lure_type_id");

-- CreateIndex
CREATE INDEX "spots_location_id_idx" ON "spots"("location_id");

-- CreateIndex
CREATE INDEX "weathers_location_id_idx" ON "weathers"("location_id");

-- CreateIndex
CREATE INDEX "fish_baits_bait_id_idx" ON "fish_baits"("bait_id");

-- CreateIndex
CREATE INDEX "fish_lure_types_lure_type_id_idx" ON "fish_lure_types"("lure_type_id");

