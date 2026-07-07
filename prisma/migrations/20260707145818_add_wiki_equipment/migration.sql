-- CreateTable
CREATE TABLE "wiki_equipment" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subtype" VARCHAR(40) NOT NULL,
    "fp_id" INTEGER,
    "image_url" TEXT,
    "brand" VARCHAR(80),
    "description" TEXT,
    "material" VARCHAR(150),
    "color" VARCHAR(60),
    "tackles" VARCHAR(20),
    "flashlight" VARCHAR(20),
    "flashlight_slot" VARCHAR(20),
    "storage_capacity" VARCHAR(150),
    "rod_slot" VARCHAR(20),
    "stand_count" VARCHAR(20),
    "bite_alarm" VARCHAR(20),
    "weight" VARCHAR(30),
    "max_single_fish_weight_kg" VARCHAR(30),
    "max_total_fish_weight_kg" VARCHAR(30),
    "fish_friendly" VARCHAR(20),
    "durability" VARCHAR(40),
    "price_credits" INTEGER,
    "price_baitcoins" INTEGER,
    "price_note" TEXT,
    "unlock_level" INTEGER,
    "source_url" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_equipment_slug_key" ON "wiki_equipment"("slug");

