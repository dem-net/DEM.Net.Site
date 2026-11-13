/** Every external link used by the header, footer, About and Home: edit them here only. */

export type Brand = 'github' | 'discord' | 'bluesky' | 'linkedin' | 'sketchfab' | 'githubSponsors' | 'patreon' | 'paypal'

export interface ExternalLink {
  brand: Brand
  label: string
  /** Longer text for the About page. */
  detail: string
  url: string
}

export const socialLinks: ExternalLink[] = [
  { brand: 'github', label: 'GitHub', detail: 'dem-net/DEM.Net, the open source library', url: 'https://github.com/dem-net/DEM.Net' },
  { brand: 'discord', label: 'Discord', detail: 'Join the community, ask questions', url: 'https://discord.gg/AKSWNSX' },
  { brand: 'bluesky', label: 'Bluesky', detail: '@xfischer.eurosky.social', url: 'https://bsky.app/profile/xfischer.eurosky.social' },
  { brand: 'linkedin', label: 'LinkedIn', detail: 'Xavier Fischer', url: 'https://www.linkedin.com/in/fischerxavier/' },
  { brand: 'sketchfab', label: 'Sketchfab', detail: 'Models made with the API', url: 'https://sketchfab.com/xfischer' },
]

export const discordLink = socialLinks.find((l) => l.brand === 'discord')!

export const sponsorLinks: ExternalLink[] = [
  { brand: 'githubSponsors', label: 'GitHub Sponsors', detail: 'Monthly or one-time', url: 'https://github.com/sponsors/xfischer' },
  { brand: 'patreon', label: 'Patreon', detail: 'Become a patron', url: 'https://www.patreon.com/bePatron?u=24134737' },
  {
    brand: 'paypal',
    label: 'PayPal',
    detail: 'One-time donation',
    url: 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=8F428QPSP9W5E&source=url',
  },
]
