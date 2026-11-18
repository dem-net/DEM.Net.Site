/**
 * Poster and turntable clip of a `<model-viewer>`, made in the browser for the gallery.
 *
 * The clip is captured frame by frame, not in real time: for each angle the camera jumps there, model-viewer renders it
 * on demand (`toBlob()`), and the frame goes to a WebCodecs H.264 encoder muxed to MP4 by mediabunny. The loop is
 * therefore smooth and closes exactly whatever the device's speed. Only the heading turns; the pitch and distance are
 * the ones the user chose.
 *
 * Found by the spike (DEM.Net.WebAPI roadmap, item 6):
 * - Drawing the viewer's own canvas returns a stale image at every angle: read frames with `toBlob()`.
 * - model-viewer applies a new `cameraOrbit` asynchronously: wait for `updateComplete` before `jumpCameraToGoal()`.
 * - Safari has no WebP encoder (`toBlob('image/webp')` silently returns a PNG): fall back to JPEG.
 */

export const TURNTABLE = {
  width: 640,
  height: 480,
  fps: 24,
  /** One turn in 4 s. */
  frames: 96,
  bitrate: 1_200_000,
  /** Behind the model (model-viewer renders a transparent background); the same in light and dark themes. */
  background: '#e9ebe6',
} as const

/** The API refuses larger clips. */
export const MAX_CLIP_BYTES = 2_000_000

/** The part of `<model-viewer>` used here. */
export interface TurntableViewer extends HTMLElement {
  cameraOrbit: string
  cameraControls: boolean
  autoRotate: boolean
  readonly updateComplete: Promise<unknown>
  jumpCameraToGoal(): void
  getCameraOrbit(): { theta: number; phi: number; radius: number }
  toBlob(options?: { mimeType?: string }): Promise<Blob>
}

export interface TurntableResult {
  poster: Blob
  /** Null when the browser can't encode H.264, or the clip came out over the API's limit. */
  clip: Blob | null
}

export interface Orbit {
  theta: number
  phi: number
  radius: number
}

/** Camera orbit of frame `i` of `frames`: one full turn from the start heading. */
export function frameOrbit(start: Orbit, i: number, frames: number): string {
  const theta = start.theta + (i * 2 * Math.PI) / frames
  return `${theta}rad ${start.phi}rad ${start.radius}m`
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
 * The viewer's camera, controls and auto-rotation are restored afterwards, also on error or cancel.
 */
export async function captureTurntable(
  mv: TurntableViewer,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<TurntableResult> {
  const { width: W, height: H, fps, frames, bitrate, background } = TURNTABLE
  const work = document.createElement('canvas')
  work.width = W
  work.height = H
  const ctx = work.getContext('2d')
  if (!ctx) throw new Error('Your browser could not prepare the capture.')

  const start = mv.getCameraOrbit()
  const saved = { controls: mv.cameraControls, autoRotate: mv.autoRotate }
  mv.cameraControls = false
  mv.autoRotate = false

  async function draw(i: number) {
    if (signal?.aborted) throw abortError()
    mv.cameraOrbit = frameOrbit(start, i, frames)
    await mv.updateComplete
    mv.jumpCameraToGoal()
    await nextFrame()
    await nextFrame()
    const bitmap = await createImageBitmap(await mv.toBlob({ mimeType: 'image/png' }))
    ctx!.fillStyle = background
    ctx!.fillRect(0, 0, W, H)
    ctx!.drawImage(bitmap, 0, 0, W, H)
    bitmap.close()
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
    mv.cameraOrbit = `${start.theta}rad ${start.phi}rad ${start.radius}m`
    await mv.updateComplete
    mv.jumpCameraToGoal()
    mv.cameraControls = saved.controls
    mv.autoRotate = saved.autoRotate
  }
}
