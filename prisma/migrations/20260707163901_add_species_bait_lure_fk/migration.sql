-- AlterTable
ALTER TABLE "wiki_species_baits" ADD COLUMN     "bait_id" INTEGER;

-- AlterTable
ALTER TABLE "wiki_species_lures" ADD COLUMN     "lure_id" INTEGER;

-- CreateIndex
CREATE INDEX "wiki_species_baits_bait_id_idx" ON "wiki_species_baits"("bait_id");

-- CreateIndex
CREATE INDEX "wiki_species_lures_lure_id_idx" ON "wiki_species_lures"("lure_id");

-- AddForeignKey
ALTER TABLE "wiki_species_baits" ADD CONSTRAINT "wiki_species_baits_bait_id_fkey" FOREIGN KEY ("bait_id") REFERENCES "wiki_baits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_species_lures" ADD CONSTRAINT "wiki_species_lures_lure_id_fkey" FOREIGN KEY ("lure_id") REFERENCES "wiki_lures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

