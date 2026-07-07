import { createHash } from 'node:crypto'
import type { ParsedBoilie } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { foldRows, iconId, norm, pick, priceOf } from './gear.js'

// Parse block-per-model boilie tables (/Boilies_&_Pellets_Baits and the boilie
// sub-section of /Event_Baits) into one record per boilie. Same broadcast-aware
// block shape as reels/rods: a `| Name | v1 | v2 … |` row sets the variant axis;
// some spec rows carry one shared value (Size/Target Fish/Buoyancy/Weight/Quantity,
// broadcast to every variant) while others are per-variant (Flavour/Color/Price/
// Required level). Each column is its own purchasable boilie, so we flatten to one
// row per column rather than a parent+variant pair (the block has no title of its
// own). foldRows/pick handle the broadcast + the (in.)/(mm) size sub-rows. The
// page mixes boilies (image row labelled `Boilies`, hookbait row `Boil`) with
// pellets (both image rows labelled `Pellets`) — read either for the main image.

const IMAGE = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/
const imgUrl = (cell: string | null): string | null => cell?.match(IMAGE)?.[1] ?? null

export function parseBoilies(markdown: string, sourceUrl: string, subtype: string): ParsedBoilie[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const anchors = lines.map((l, i) => (/^\|\s*Name\s*\|/i.test(l) ? i : -1)).filter((i) => i >= 0)
  const out: ParsedBoilie[] = []

  anchors.forEach((start, k) => {
    const block = lines.slice(start, k + 1 < anchors.length ? anchors[k + 1] : lines.length)
    const F = foldRows(block.map(tableCells))
    const names = F.get('Name')
    if (!names || names.length === 0) return
    const n = names.length
    for (let j = 0; j < n; j++) {
      const name = norm(names[j])
      if (!name) continue
      const imageUrl = imgUrl(pick(F, 'Boilies', j, n) ?? pick(F, 'Pellets', j, n))
      const desc = pick(F, 'Description', j, n)
      out.push({
        slug: slugify(`${subtype} ${name} ${imageUrl ? iconId(imageUrl) ?? '' : ''}`),
        name,
        subtype,
        fpId: imageUrl ? iconId(imageUrl) : null,
        imageUrl,
        boilImageUrl: imgUrl(pick(F, 'Boil', j, n)),
        description: desc ? stripMd(desc) : null,
        sizeIn: pick(F, 'Size::(in.)', j, n),
        sizeMm: pick(F, 'Size::(mm)', j, n),
        targetFish: (pick(F, 'Target Fish', j, n) ?? '').split(',').map((s) => stripMd(s)).filter(Boolean),
        flavour: pick(F, 'Flavour', j, n),
        color: pick(F, 'Color', j, n),
        buoyancy: pick(F, 'Buoyancy', j, n),
        weightClass: pick(F, 'Weight', j, n),
        quantity: num(pick(F, 'Quantity', j, n)),
        unlockLevel: num(pick(F, 'Required level', j, n)),
        ...priceOf(pick(F, 'Price', j, n) ?? ''),
        sourceUrl,
        contentHash,
      })
    }
  })
  return out
}
