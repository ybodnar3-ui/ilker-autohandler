const AD_TAIL = /\s*\/{2,}[\s\S]*$/
const TRAILING_PUNCT = /[\s,\-–—/]+$/

/** Умляути мають усталену транслітерацію; решту діакритики просто знімаємо. */
const UMLAUTS: Array<[RegExp, string]> = [
  [/ä/g, 'ae'], [/ö/g, 'oe'], [/ü/g, 'ue'], [/ß/g, 'ss'],
]

/**
 * Приводить заголовок willhaben до вигляду, придатного для показу.
 * Дилер дописує в заголовки рекламу («/// FINANZIERUNG 0€ MÖGLICH ///») —
 * на willhaben це працює на видачу, на власному сайті виглядає дешево.
 */
export function cleanTitle(heading: string, make: string, model: string): string {
  let text = heading ?? ''
  let truncatedMidWord = false

  if (AD_TAIL.test(text)) {
    text = text.replace(AD_TAIL, '')
  } else if (text.endsWith('...')) {
    // willhaben обрізав рядок усередині змістовної частини
    text = text.slice(0, -3)
    truncatedMidWord = true
  }

  text = text.replace(/\s+/g, ' ').replace(TRAILING_PUNCT, '').trim()

  if (truncatedMidWord) {
    const words = text.split(' ')
    if (words.length > 1) {
      words.pop() // останнє слово неповне
      text = words.join(' ')
    }
  }

  const meaninglessModel = !model || model === 'Sonstige'
  if (!text || text === make) {
    text = meaninglessModel ? make : `${make} ${model}`
  }

  return text.trim()
}

export function slugify(text: string): string {
  let out = text.toLowerCase()
  for (const [pattern, replacement] of UMLAUTS) out = out.replace(pattern, replacement)
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Id у кінці гарантує унікальність, навіть якщо дві машини звуться однаково. */
export function carSlug(title: string, id: string): string {
  return `${slugify(title)}-${id}`
}
