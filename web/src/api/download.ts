/** File name of a URL (last path segment). */
export function fileNameOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'download')
  } catch {
    return 'download'
  }
}

/**
 * Saves an API file under its own name. `<a download>` is ignored for cross-origin URLs, so a world file
 * or .prj (served as text/plain) would just open in a tab: fetch it as a blob instead.
 * Falls back to opening the URL if the fetch fails.
 */
export async function saveFile(url: string): Promise<void> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blobUrl = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileNameOf(url)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}
