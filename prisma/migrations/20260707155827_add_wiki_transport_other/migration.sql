-- CreateTable
CREATE TABLE "wiki_transport" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "length_ft" VARCHAR(20),
    "length_cm" VARCHAR(20),
    "width_ft" VARCHAR(20),
    "width_cm" VARCHAR(20),
    "weight_lb" VARCHAR(20),
    "weight_kg" VARCHAR(20),
    "material" VARCHAR(80),
    "passenger_capacity" VARCHAR(20),
    "engine" VARCHAR(80),
    "echo_sounder" VARCHAR(120),
    "rod_holders" VARCHAR(80),
    "gps" VARCHAR(20),
    "detailing" VARCHAR(20),
    "unlock_level" INTEGER,
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_other" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "description" TEXT,
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_other_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_transport_slug_key" ON "wiki_transport"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_other_slug_key" ON "wiki_other"("slug");

