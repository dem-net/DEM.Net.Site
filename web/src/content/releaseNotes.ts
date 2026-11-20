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
    title: 'Week of November 15 – 21, 2026',
    date: '2026-11-21',
    layers: [
      {
        name: 'Website',
        items: [
          'You can now support the project with Buy Me a Coffee.',
          'The FAQ and Expo are now sections of the About page, to make room in the menu.',
          'New Gallery: publish a glTF model with a poster and a turntable made in your browser, browse the models others shared, download them or generate them again. Every model is reviewed before it appears.',
          'Map to 3D: OpenStreetMap buildings and roads are back, each with its own switch. Ski pistes are not available for now.',
          'The size estimate now includes the OpenStreetMap features.',
          'Mapterhorn: choose the resolution (Low, Medium, High, Best), with the sample spacing and estimated size of each. Buildings are white by default.',
          'Mapterhorn is now the default elevation data, with a 1.5× vertical exaggeration.',
          'Fixed the page scrolling past the panel when Mapterhorn is selected.',
          'Stats: each new generation is named after its place (older ones show "Unknown location").',
          'Publishing on Sketchfab fills in the model name from its location, and the description links back to the model.',
        ],
      },
      {
        name: 'Elevation API',
        items: [
          'Gallery endpoints (api/gallery): anonymous submissions with a private delete link, review by the owner, paged listing of the published models.',
          'OpenStreetMap data now comes from a local Protomaps archive instead of the Overpass API: faster and more reliable.',
          'The OSM model size estimate counts buildings and roads (onlyEstimateSize=true), and "Features only" models (withTerrain=false) work again.',
          'Much faster OpenStreetMap models with Mapterhorn (a dense city went from minutes to seconds), and roads sit 50 cm above the terrain so they no longer flicker through it.',
        ],
      },
      {
        name: 'DEM.Net library',
        items: [
          'OpenStreetMap extension: PMTiles (Protomaps) data source, with a fast size count.',
          'Faster point and line elevations: decoded Mapterhorn tiles are shared between lookups.',
        ],
      },
    ],
  },
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
