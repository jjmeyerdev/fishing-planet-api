import { createHash } from 'node:crypto'
import type { ParsedTransport } from './types.js'
import { num, slugify, tableCells } from './markdown.js'
import { foldRows, iconId, norm, pick, priceOf } from './gear.js'

// Parse a transport sub-type page (/Bass_Boats, /Fishing_Yachts, /Kayaks,
// /Motor_Boats) into one record per vehicle. Block-per-model like boilies: a
// `| Model | v1 … |` row sets the variant axis and foldRows/pick handle the
// (ft.)/(cm), (lb.)/(kg) unit sub-rows plus broadcast values. The model photo is a
// bare image that sits just *before* its Model row, so take the nearest image
// above each anchor (a block's own image would belong to the next model).

const IMG = /!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/

export function parseTransport(markdown: string, sourceUrl: string, subtype: string): ParsedTransport[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const lines = markdown.split('\n')
  const anchors = lines.map((l, i) => (/^\|\s*Model\s*\|/i.test(l) ? i : -1)).filter((i) => i >= 0)
  const imageLines = lines.map((l, i) => (IMG.test(l) && !/Credits|Baitcoins/i.test(l) ? i : -1)).filter((i) => i >= 0)
  const out: ParsedTransport[] = []

  anchors.forEach((start, k) => {
    const block = lines.slice(start, k + 1 < anchors.length ? anchors[k + 1] : lines.length)
    const F = foldRows(block.map(tableCells))
    const models = F.get('Model')
    if (!models || models.length === 0) return
    const n = models.length
    const prev = k > 0 ? anchors[k - 1] : -1
    const imgLine = [...imageLines].reverse().find((i) => i < start && i > prev)
    const imageUrl = imgLine != null ? lines[imgLine].match(IMG)?.[1] ?? null : null
    const fpId = imageUrl ? iconId(imageUrl) : null

    for (let j = 0; j < n; j++) {
      const name = norm(models[j])
      if (!name) continue
      out.push({
        slug: slugify(`${subtype} ${name} ${fpId ?? ''}`),
        name,
        subtype,
        fpId,
        imageUrl,
        lengthFt: pick(F, 'Length::(ft.)', j, n),
        lengthCm: pick(F, 'Length::(cm)', j, n),
        widthFt: pick(F, 'Width::(ft.)', j, n),
        widthCm: pick(F, 'Width::(cm)', j, n),
        weightLb: pick(F, 'Weight::(lb.)', j, n),
        weightKg: pick(F, 'Weight::(kg)', j, n),
        material: pick(F, 'Material', j, n),
        passengerCapacity: pick(F, 'Passenger Capacity', j, n),
        engine: pick(F, 'Engine', j, n),
        echoSounder: pick(F, 'Echo Sounder', j, n),
        rodHolders: pick(F, 'Rod Holders', j, n),
        gps: pick(F, 'GPS', j, n),
        detailing: pick(F, 'Detailing', j, n),
        unlockLevel: num(pick(F, 'Required level', j, n)),
        ...priceOf(pick(F, 'Price', j, n) ?? ''),
        sourceUrl,
        contentHash,
      })
    }
  })
  return out
}
