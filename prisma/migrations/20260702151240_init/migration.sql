-- CreateTable
CREATE TABLE "fish" (
    "id" SERIAL NOT NULL,
    "common_name" VARCHAR(100) NOT NULL,
    "scientific_name" VARCHAR(100),
    "family" VARCHAR(50),
    "description" TEXT,
    "is_event_fish" BOOLEAN NOT NULL DEFAULT false,
    "is_monster" BOOLEAN NOT NULL DEFAULT false,
    "weight_young_min" DECIMAL(65,30),
    "weight_young_max" DECIMAL(65,30),
    "weight_common_min" DECIMAL(65,30),
    "weight_common_max" DECIMAL(65,30),
    "weight_trophy_min" DECIMAL(65,30),
    "weight_unique_min" DECIMAL(65,30),
    "weight_unique_max" DECIMAL(65,30),
    "monster_target_weight" DECIMAL(65,30),
    "credits_per_kg_common" DECIMAL(65,30),
    "credits_per_kg_trophy" DECIMAL(65,30),
    "credits_per_kg_unique" DECIMAL(65,30),
    "xp_curve_notes" TEXT,
    "farming_meta_tier" VARCHAR(10),
    "notes_farming" TEXT,
    "data_version" VARCHAR(20),
    "last_verified" DATE,

    CONSTRAINT "fish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "region" VARCHAR(50) NOT NULL,
    "waterway_type" VARCHAR(50) NOT NULL,
    "unlock_level" INTEGER NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fish_locations" (
    "fish_id" INTEGER NOT NULL,
    "location_id" INTEGER NOT NULL,
    "specific_spot" VARCHAR(100) NOT NULL,
    "classes_present" VARCHAR(50)[],

    CONSTRAINT "fish_locations_pkey" PRIMARY KEY ("fish_id","location_id","specific_spot")
);

-- CreateTable
CREATE TABLE "biting_preferences" (
    "fish_id" INTEGER NOT NULL,
    "preferred_baits" TEXT[],
    "preferred_lures" TEXT[],
    "preferred_lure_colors" TEXT[],
    "hook_size_min" VARCHAR(10),
    "hook_size_max" VARCHAR(10),
    "depth_zone" VARCHAR(20),
    "sunny_peak_times" TEXT,
    "cloudy_peak_times" TEXT,
    "rainy_peak_times" TEXT,

    CONSTRAINT "biting_preferences_pkey" PRIMARY KEY ("fish_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fish_common_name_key" ON "fish"("common_name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- AddForeignKey
ALTER TABLE "fish_locations" ADD CONSTRAINT "fish_locations_fish_id_fkey" FOREIGN KEY ("fish_id") REFERENCES "fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fish_locations" ADD CONSTRAINT "fish_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biting_preferences" ADD CONSTRAINT "biting_preferences_fish_id_fkey" FOREIGN KEY ("fish_id") REFERENCES "fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
