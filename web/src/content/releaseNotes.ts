/**
 * Release notes shown on the About page (#release-notes), newest first.
 * Keep them short and written for users: what changed for them, per layer.
 */
export interface ReleaseNotes {
  title: string
  /** yyyy-mm-dd of the last day covered */
  date: string
  layers: { name: string; items: string[] }[]
}

export const releaseNotes: ReleaseNotes[] = [
  {
    title: 'Week of November 8 – 14, 2026',
    date: '2026-11-14',
    layers: [
      {
        name: 'Website',
        items: [
          'Rebuilt from scratch: faster, works on phones, follows your light or dark theme.',
          'New Textures page: a georeferenced texture, normal map and 16-bit height map of any area, one by one or as a ZIP.',
          'New Statistics page: every model and texture set generated, mapped per dataset, with a replay of the history and a list of the 100 latest generations. View recent models in 3D, or generate the same one again.',
          'Map to 3D: a Share button (the link keeps the area, the map view and your options), and a size estimate before you generate.',
          '3D previews: wireframe view, optional scale bar and north arrow, better default lighting. The TIN option is gone.',
          'No more Google Analytics: visits are measured without cookies, and a Privacy page explains what is recorded.',
        ],
      },
      {
        name: 'Elevation API',
        items: [
          'New textures endpoint (/api/texture/bbox): texture, normal map and height map, each with a world file and a .prj. 3D models no longer write separate texture files, so they are faster.',
          'New public statistics endpoints (/api/stats/generations).',
          'OpenAPI documentation with an example for every parameter.',
          'Fair use: one generation at a time per client (HTTP 429 with Retry-After) and models up to 100 MB.',
          'Moved to .NET 10. Request logs are no longer public. The VisualTopo / speleology endpoints were removed.',
        ],
      },
      {
        name: 'DEM.Net library',
        items: [
          'Moved to .NET 10, vulnerable packages fixed, System.Drawing replaced by ImageSharp.',
          'Streamed PNG generation for very large textures and height maps.',
          'Less shiny terrain in glTF models (no specular highlights).',
          'OpenStreetMap and Sketchfab libraries moved to .NET 10.',
        ],
      },
      {
        name: 'Audience measurement',
        items: [
          'A self-hosted analytics server (m.elevationapi.com), hosted in the EU: no cookies, no identifiers, IP addresses never stored. It measures both the website and the API.',
        ],
      },
    ],
  },
]
