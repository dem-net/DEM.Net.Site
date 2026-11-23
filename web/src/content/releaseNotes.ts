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
    title: 'Week of November 22 – 28, 2026',
    date: '2026-11-28',
    layers: [
      {
        name: 'Website',
        items: [
          'Map to 3D: OpenStreetMap buildings, with their mapped colours, are now on by default (roads off), and the mesh detail starts at 10 %.',
          'The three Thunderforest imagery styles (Outdoors, Landscape, Neighbourhood) now have distinct names.',
          'glTF models from the bathymetry datasets (ETOPO1, GEBCO) now show the sea where the area goes below 0 m: translucent water at 0 m, with water on the walls of boxed models. "Sea at 0 m" in the advanced options turns it off, for land below sea level like the Dead Sea.',
          'The dataset lists (the "Elevation data" picker and About) now show which datasets include the sea floor (bathymetry).',
        ],
      },
      {
        name: 'Elevation API',
        items: ['New water option for glTF models from the bathymetry datasets (ETOPO1, GEBCO): the sea at 0 m where the terrain goes below it, as its own translucent "Water" node in the model.'],
      },
      {
        name: 'DEM.Net library',
        items: ['Terrain meshes can get a flat water surface at a given level, with water walls on the sides of boxed models (TerrainWaterOptions).'],
      },
    ],
  },
  {
    title: 'Week of November 15 – 21, 2026',
    date: '2026-11-21',
    layers: [
      {
        name: 'Website',
        items: [
          'Map to 3D: many more buildings have a height (in the Alps, about a third instead of 1 %), mostly estimated by machine learning where OpenStreetMap has none, and "Use mapped building colours" now finds facade and roof colours where they are mapped.',
          'New 3D preview: sky lighting, a sun with real shadows and ambient occlusion, so the relief reads much better. The Lighting button adjusts the sun, sky, exposure, shadows and ambient occlusion.',
          'Gallery: the poster and turntable use the lighting you chose, and the gallery shows your model with it.',
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
          'Buildings now come from the Overture Maps buildings archive (OpenStreetMap plus other open sources): floor counts and colours that the previous archive dropped, and Microsoft machine-learning height estimates where OpenStreetMap has no height. Roads and water still come from Protomaps.',
          'Gallery submissions can include the 3D preview lighting (viewer), returned with the item.',
          'Gallery endpoints (api/gallery): anonymous submissions with a private delete link, review by the owner, paged listing of the published models.',
          'OpenStreetMap data now comes from a local Protomaps archive instead of the Overpass API: faster and more reliable.',
          'The OSM model size estimate counts buildings and roads (onlyEstimateSize=true), and "Features only" models (withTerrain=false) work again.',
          'Much faster OpenStreetMap models with Mapterhorn (a dense city went from minutes to seconds), and roads sit 50 cm above the terrain so they no longer flicker through it.',
          'GPX to 3D: the 3D track now follows the relief between the points of your GPX file, instead of cutting through slopes and ridges when they are far apart.',
        ],
      },
      {
        name: 'DEM.Net library',
        items: [
          'OpenStreetMap extension: optional Overture Maps buildings archive (BuildingsPMTilesFilePath), with floors, roof shape, colours and materials mapped to OSM tags; building:min_level is now used.',
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
