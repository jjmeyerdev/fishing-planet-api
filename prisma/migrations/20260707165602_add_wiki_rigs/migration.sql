-- CreateTable
CREATE TABLE "wiki_rigs" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "brand" VARCHAR(80),
    "diameter_mm" VARCHAR(40),
    "test_lb" VARCHAR(40),
    "test_kg" VARCHAR(40),
    "length" VARCHAR(80),
    "colors" VARCHAR(80),
    "count" VARCHAR(40),
    "unlock_level" VARCHAR(40),
    "price" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_rigs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_rigs_slug_key" ON "wiki_rigs"("slug");

