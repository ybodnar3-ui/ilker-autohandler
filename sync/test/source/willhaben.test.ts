import { describe, it, expect } from 'vitest'
import { extractAdverts, attributesOf } from '../../src/source/willhaben'

const page = (payload: unknown) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`

const wrap = (adverts: unknown[]) => ({
  props: { pageProps: { searchResult: { advertSummaryList: { advertSummary: adverts } } } },
})

describe('extractAdverts', () => {
  it('дістає оголошення з __NEXT_DATA__', () => {
    const html = page(wrap([{ id: '123', attributes: { attribute: [] } }]))
    expect(extractAdverts(html)).toHaveLength(1)
  })

  it('кидає помилку, якщо блок __NEXT_DATA__ відсутній', () => {
    expect(() => extractAdverts('<html></html>')).toThrow(/__NEXT_DATA__/)
  })

  it('кидає помилку на пошкодженому JSON', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{нея</script>'
    expect(() => extractAdverts(html)).toThrow()
  })

  it('повертає порожній масив, коли оголошень немає', () => {
    expect(extractAdverts(page(wrap([])))).toEqual([])
  })
})

describe('attributesOf', () => {
  it('перетворює список атрибутів на словник', () => {
    const ad = {
      id: '1',
      attributes: { attribute: [{ name: 'PRICE', values: ['330000'] }] },
    }
    expect(attributesOf(ad as never)).toEqual({ PRICE: '330000' })
  })

  it('склеює кілька значень через кому', () => {
    const ad = {
      id: '1',
      attributes: { attribute: [{ name: 'X', values: ['a', 'b'] }] },
    }
    expect(attributesOf(ad as never).X).toBe('a|b')
  })
})
