import { computed, ref } from 'vue'
import { ApiError, galleryAdmin } from '@/api/client'
import type { GalleryAdminSession, GalleryItem, GalleryKind } from '@/api/types'
import { regenerateLink, type RegenerateLink } from './regenerate'

export const GALLERY_KIND_LABELS: Record<GalleryKind, string> = {
  terrain: 'Map to 3D',
  osm: 'Map to 3D + OSM',
  gpx: 'GPX to 3D',
}

/** "Generate again" for a gallery model: the same area and options on Map to 3D (GPX tracks: the area only). */
export function galleryRegenerateLink(item: GalleryItem): RegenerateLink | null {
  return regenerateLink(
    {
      id: null,
      dataset: item.dataset,
      kind: item.kind,
      format: 'glTF',
      sizeBytes: item.modelBytes,
      date: (item.publishedAt ?? item.createdAt).slice(0, 10),
      bbox: item.bbox,
      place: item.place,
    },
    item.options,
  )
}

/** "Jun 2, 2026" from an ISO date-time. */
export function formatGalleryDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ---------- Moderation session ----------
// In memory only, shared by the gallery pages while the tab stays on the site: a reload signs out, and nothing is
// written to browser storage (so nothing to disclose on /privacy).

const session = ref<GalleryAdminSession | null>(null)

function current(): string | null {
  const s = session.value
  if (s && Date.parse(s.expiresAt) > Date.now()) return s.session
  session.value = null
  return null
}

export function useGalleryAdmin() {
  return {
    /** An expired session is noticed (and cleared) by the next call. */
    signedIn: computed(() => session.value !== null),

    async signIn(linkToken: string) {
      session.value = await galleryAdmin.signIn(linkToken)
    },

    async signOut() {
      const s = current()
      session.value = null
      if (s) await galleryAdmin.signOut(s).catch(() => {})
    },

    /**
     * Runs a moderation call with the session. A 401 (expired, or the API restarted) signs out and rethrows with
     * a readable message.
     */
    async call<T>(fn: (session: string) => Promise<T>): Promise<T> {
      const s = current()
      if (!s) throw new ApiError(401, 'Your session has expired. Sign in again.')
      try {
        return await fn(s)
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          session.value = null
          throw new ApiError(401, 'Your session has expired. Sign in again.')
        }
        throw e
      }
    },
  }
}
