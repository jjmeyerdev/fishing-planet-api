import { createHash } from 'node:crypto'
import type { ParsedLure, ParsedLureVariant } from './types.js'
import { num, slugify, stripMd, tableCells } from './markdown.js'
import { foldRows, norm, pick, priceOf } from './gear.js'

// Parse a lure sub-type page (/Spoons, /Plugs, …) into one record per model. No
// brand or technologies. Each model is a `## **Name**` section with one table per
// color; within a color the size variants are the trailing value columns — so a
// model expands to (color × size) variants. The name cell of each color block is
// `Name<br>[![NNN.png](…)](…)<br>Color`.

const HAS_IMAGE = /!\[[^\]]*\]\([^)]*\/images\/[^)]+\)/

export function parseLures(markdown: string, sourceUrl: string, subtype: string): ParsedLure[] {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const out: ParsedLure[] = []

  for (const part of markdown.split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n')
    const name = stripMd(nl < 0 ? part : part.slice(0, nl))
    if (!name || /^contents$/i.test(name)) continue
    const body = nl < 0 ? [] : part.slice(nl + 1).split('\n')

    let description: string | null = null
    const variants: ParsedLureVariant[] = []
    let group: string[] | null = null
    const flush = () => {
      if (group) variants.push(...parseColorBlock(group))
    }
    for (const l of body) {
      if (!l.trim().startsWith('|')) {
        if (!description && l.trim()) description = stripMd(l)
        continue
      }
      const cell0 = tableCells(l)[0] ?? ''
      if (HAS_IMAGE.test(cell0)) {
        flush()
        group = [l]
      } else if (group) {
        group.push(l)
      }
    }
    flush()
    if (variants.length === 0) continue

    out.push({ slug: slugify(`${subtype} ${name}`), name, subtype, description, variants, sourceUrl, contentHash })
  }
  return out
}

function parseColorBlock(lines: string[]): ParsedLureVariant[] {
  const anchor = tableCells(lines[0])
  const { image, color } = nameCell(anchor[0])
  const rows = [anchor.slice(1), ...lines.slice(1).map(tableCells)]
  const F = foldRows(rows)

  const n = (F.get('Required level') ?? F.get('Weight::(g)') ?? F.get('Length::(cm)') ?? F.get('Price') ?? [null]).length
  const buoyancy = F.get('Bouyancy')?.[0] ?? F.get('Buoyancy')?.[0] ?? null

  return Array.from({ length: n }, (_, j): ParsedLureVariant => {
    const price = priceOf(pick(F, 'Price', j, n) ?? '')
    return {
      color,
      imageUrl: image,
      buoyancy: buoyancy ? norm(buoyancy) : null,
      weightG: num(pick(F, 'Weight::(g)', j, n)),
      lengthCm: num(pick(F, 'Length::(cm)', j, n)),
      divingDepthM: num(pick(F, 'Depth::(m)', j, n)),
      hookSize: pick(F, 'Hook Size', j, n) ?? pick(F, 'Fitting Hook', j, n),
      quantity: num(pick(F, 'Quantity', j, n)),
      unlockLevel: num(pick(F, 'Required level', j, n)),
      ...price,
    }
  })
}

// `Name<br>[![NNN.png](thumb)](File:…)<br>Color` → image + color (name comes from
// the section heading; bass-jig cells omit the name entirely).
function nameCell(cell: string): { image: string | null; color: string | null } {
  const im = cell.match(/!\[[^\]]*\]\((https?:\/\/[^)]*\/images\/[^)]+)\)/)
  const image = im && !/Credits|Baitcoins/i.test(im[1]) ? im[1] : null
  const segs = cell.split(/<br\s*\/?>/i)
  let color: string | null = null
  for (let i = segs.length - 1; i >= 0; i--) {
    if (/!\[/.test(segs[i])) continue
    const s = stripMd(segs[i])
    if (s) {
      color = s
      break
    }
  }
  return { image, color }
}
