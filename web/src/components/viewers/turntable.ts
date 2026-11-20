/**
 * Poster and turntable clip of the 3D preview, made in the browser for the gallery.
 *
 * The clip is captured frame by frame, not in real time: for each angle the viewer renders the frame at the clip's
 * size (sun, shadows and ambient occlusion included), it is copied at once to a 2D canvas, and that canvas goes to a
 * WebCodecs H.264 encoder muxed to MP4 by mediabunny. The loop is therefore smooth and closes exactly whatever the
 * device's speed. Only the heading turns; the pitch and distance are the ones the user chose.
 *
 * - The WebGL canvas doesn't preserve its drawing buffer: copy it in the same task as the render, before any await.
 * - Safari has no WebP encoder (`toBlob('image/webp')` silently returns a PNG): fall back to JPEG.
 */
import { frameOrbit, type Orbit } from './lighting'
import type { ViewerSettings } from '@/api/viewerSettings'

export const TURNTABLE = {
  width: 640,
  height: 480,
  fps: 24,
  /** One turn in 4 s. */
  frames: 96,
  bitrate: 1_200_000,
  /** Behind the model (the viewer renders a transparent background); the same in light and dark themes. */
  background: '#e9ebe6',
} as const

/** The API refuses larger clips. */
export const MAX_CLIP_BYTES = 2_000_000

/** The part of the viewer's scene (TerrainScene) used here. */
export interface TurntableViewer {
  getOrbit(): Orbit
  beginCapture(width: number, height: number): void
  renderFrame(orbit: Orbit): CanvasImageSource
  endCapture(orbit: Orbit): void
}

export interface TurntableResult {
  poster: Blob
  /** Null when the browser can't encode H.264, or the clip came out over the API's limit. */
  clip: Blob | null
}

/** A capture from the viewer, with the lighting it was made with (saved with a gallery submission). */
export interface ViewCapture extends TurntableResult {
  viewer: ViewerSettings
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

function abortError() {
  return new DOMException('The capture was cancelled.', 'AbortError')
}

async function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** WebP, or JPEG where the browser can't encode WebP (Safari). The API re-encodes it to WebP either way. */
async function posterOf(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await canvasBlob(canvas, 'image/webp', 0.85)
  if (webp?.type === 'image/webp') return webp
  const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.9)
  if (!jpeg) throw new Error('Your browser could not make the poster image.')
  return jpeg
}

/**
 * Captures the poster at the current view, then one full turn as an MP4 clip when the browser can encode H.264.
 * The viewer's size, camera and controls are restored afterwards, also on error or cancel.
 */
export async function captureTurntable(
  viewer: TurntableViewer,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<TurntableResult> {
  const { width: W, height: H, fps, frames, bitrate, background } = TURNTABLE
  const work = document.createElement('canvas')
  work.width = W
  work.height = H
  const ctx = work.getContext('2d')
  if (!ctx) throw new Error('Your browser could not prepare the capture.')

  const start = viewer.getOrbit()
  viewer.beginCapture(W, H)

  async function draw(i: number) {
    if (signal?.aborted) throw abortError()
    await nextFrame() // let the page breathe (progress bar, cancel button) between frames
    const frame = viewer.renderFrame(frameOrbit(start, i, frames))
    ctx!.fillStyle = background
    ctx!.fillRect(0, 0, W, H)
    ctx!.drawImage(frame, 0, 0, W, H)
  }

  try {
    onProgress?.(0)
    await draw(0)
    const poster = await posterOf(work)

    const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeVideo } = await import('mediabunny')
    const encodable = typeof VideoEncoder !== 'undefined' && (await canEncodeVideo('avc', { width: W, height: H, bitrate }))
    if (!encodable) return { poster, clip: null }

    const target = new BufferTarget()
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target })
    const source = new CanvasSource(work, { codec: 'avc', bitrate, keyFrameInterval: 2 })
    output.addVideoTrack(source, { frameRate: fps })
    await output.start()
    try {
      for (let i = 0; i < frames; i++) {
        if (i > 0) await draw(i) // frame 0 is still on the canvas from the poster
        await source.add(i / fps, 1 / fps)
        onProgress?.((i + 1) / frames)
      }
      await output.finalize()
    } catch (e) {
      await output.cancel().catch(() => {})
      throw e
    }
    const clip = target.buffer ? new Blob([target.buffer], { type: 'video/mp4' }) : null
    return { poster, clip: clip && clip.size <= MAX_CLIP_BYTES ? clip : null }
  } finally {
    viewer.endCapture(start)
  }
}
