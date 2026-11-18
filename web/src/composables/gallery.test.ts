import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, api, galleryAdmin, hashParam, toGalleryItem, type GalleryItemResponse } from '@/api/client'
import { galleryRegenerateLink, useGalleryAdmin } from './gallery'

const ID = '0123456789abcdef0123456789abcdef'

function raw(over: Partial<GalleryItemResponse> = {}): GalleryItemResponse {
  return {
    id: ID,
    status: 'published',
    title: 'Mont Blanc',
    kind: 'terrain',
    dataset: 'Mapterhorn',
    options: { textured: 'true', imageryProvider: 'MapBox-SatelliteStreet', zFactor: '1.5' },
    bbox: [6.85, 45.82, 6.88, 45.84],
    modelBytes: 5_000_000,
    createdAt: '2026-11-18T10:00:00Z',
    publishedAt: '2026-11-18T12:00:00Z',
    posterUrl: `/api/gallery/${ID}/poster`,
    clipUrl: null,
    modelUrl: `/api/gallery/${ID}/model`,
    ...over,
  }
}

function stubFetch(status: number, body: unknown = null) {
  const fetch = vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('gallery item', () => {
  it('reads the API answer: bbox order, absolute file URLs, missing fields as null', () => {
    const item = toGalleryItem(raw())
    expect(item.bbox).toEqual({ west: 6.85, south: 45.82, east: 6.88, north: 45.84 })
    expect(item.posterUrl).toBe(`${API_BASE}/api/gallery/${ID}/poster`)
    expect(item.clipUrl).toBeNull()
    expect(item.description).toBeNull()
    expect(item.pseudonym).toBeNull()
    expect(item.attributions).toEqual([])
  })

  it('drops a malformed bbox and an unknown kind', () => {
    const item = toGalleryItem(raw({ bbox: [1, 2, 3], kind: 'textures' }))
    expect(item.bbox).toBeNull()
    expect(item.kind).toBe('terrain')
  })

  it('reads the token and login fragments', () => {
    expect(hashParam('#token=abc-_9', 'token')).toBe('abc-_9')
    expect(hashParam('#login=xyz', 'token')).toBeNull()
    expect(hashParam('', 'login')).toBeNull()
  })
})

describe('generate again', () => {
  it('opens the same area and options on Map to 3D', () => {
    const link = galleryRegenerateLink(toGalleryItem(raw()))!
    expect(link.path).toBe('/terrain')
    expect(link.query.bbox).toBe('6.85,6.88,45.82,45.84') // west,east,south,north
    expect(link.areaOnly).toBe(false)
  })

  it('keeps the OSM options, and only the area of a GPX model', () => {
    expect(galleryRegenerateLink(toGalleryItem(raw({ kind: 'osm' })))!.query.osm).toBe('1')
    expect(galleryRegenerateLink(toGalleryItem(raw({ kind: 'gpx' })))!.areaOnly).toBe(true)
  })

  it('has no link without an area', () => {
    expect(galleryRegenerateLink(toGalleryItem(raw({ bbox: null })))).toBeNull()
  })
})

describe('gallery calls', () => {
  it('pages with the cursor', async () => {
    const fetch = stubFetch(200, { items: [raw()], next: 'abc_def' })
    const page = await api.galleryList('123_' + ID, 24)
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe(`${API_BASE}/api/gallery?cursor=123_${ID}&limit=24`)
    expect(page.next).toBe('abc_def')
    expect(page.items[0].title).toBe('Mont Blanc')
  })

  it('treats a model that is not published as missing', async () => {
    stubFetch(404)
    await expect(api.galleryItem(ID)).resolves.toBeNull()
  })

  it('deletes with the token in a header, never in the URL', async () => {
    const fetch = stubFetch(204)
    await api.galleryDelete(ID, 'SECRET')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${API_BASE}/api/gallery/${ID}`)
    expect(url).not.toContain('SECRET')
    expect(init.method).toBe('DELETE')
    expect(init.headers).toEqual({ 'X-Gallery-Token': 'SECRET' })
  })
})

describe('moderation session', () => {
  it('sends the session as a bearer token, and signs out on 401', async () => {
    const admin = useGalleryAdmin()
    stubFetch(200, { session: 'S1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
    await admin.signIn('LINK')
    expect(admin.signedIn.value).toBe(true)

    const ok = stubFetch(200, [raw({ status: 'pending' })])
    const items = await admin.call((s) => galleryAdmin.pending(s))
    expect(items).toHaveLength(1)
    expect((ok.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual({ Authorization: 'Bearer S1' })

    stubFetch(401)
    await expect(admin.call((s) => galleryAdmin.approve(s, ID))).rejects.toThrow(/expired/)
    expect(admin.signedIn.value).toBe(false)
  })

  it('refuses calls once the session has expired', async () => {
    const admin = useGalleryAdmin()
    stubFetch(200, { session: 'S2', expiresAt: new Date(Date.now() - 1000).toISOString() })
    await admin.signIn('LINK')
    const fetch = stubFetch(204)
    await expect(admin.call((s) => galleryAdmin.approve(s, ID))).rejects.toThrow(/expired/)
    expect(fetch).not.toHaveBeenCalled()
  })
})
