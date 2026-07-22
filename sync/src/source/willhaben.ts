export interface RawAttribute {
  name: string
  values: string[]
}

export interface RawAdvert {
  id: string
  attributes: { attribute: RawAttribute[] }
  advertImageList?: { advertImage?: Array<{ name: string }> }
}

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/

/**
 * Дістає оголошення з JSON, який Next.js вбудовує у сторінку.
 * Ми навмисно не парсимо верстку: зміна дизайну willhaben нас не ламає,
 * ламає лише зміна структури даних.
 */
export function extractAdverts(html: string): RawAdvert[] {
  const match = NEXT_DATA.exec(html)
  if (!match?.[1]) {
    throw new Error('Блок __NEXT_DATA__ не знайдено — структура сторінки змінилась')
  }

  const data = JSON.parse(match[1]) as {
    props?: { pageProps?: { searchResult?: { advertSummaryList?: { advertSummary?: RawAdvert[] } } } }
  }

  return data.props?.pageProps?.searchResult?.advertSummaryList?.advertSummary ?? []
}

/** Атрибути приходять списком пар; для роботи зручніший словник. */
export function attributesOf(ad: RawAdvert): Record<string, string> {
  const out: Record<string, string> = {}
  for (const attr of ad.attributes?.attribute ?? []) {
    out[attr.name] = attr.values.join('|')
  }
  return out
}
