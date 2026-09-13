/* Public API — @2one/design-library
   2one Design Language System: shadcn/ui components re-skinned to 2one tokens.
   Import styles once at your app root: '@2one/design-library/styles' */

// theming — light + audited dark (grayscale-founded + one brand accent, --brand)
export * from './theme-provider'

// hooks — for the responsive-panel pattern (inline on md+, Sheet on mobile)
export { useIsMobile } from './hooks/use-mobile'

// shadcn primitives (2one-themed)
export * from './components/ui/accordion'
export * from './components/ui/alert-dialog'
export * from './components/ui/alert'
export * from './components/ui/aspect-ratio'
export * from './components/ui/avatar'
export * from './components/ui/badge'
export * from './components/ui/breadcrumb'
export * from './components/ui/button-group'
export * from './components/ui/button'
export * from './components/ui/calendar'
export * from './components/ui/card'
export * from './components/ui/carousel'
export * from './components/ui/chart'
export * from './components/ui/checkbox'
export * from './components/ui/collapsible'
export * from './components/ui/command'
export * from './components/ui/context-menu'
export * from './components/ui/dialog'
export * from './components/ui/drawer'
export * from './components/ui/dropdown-menu'
export * from './components/ui/empty'
export * from './components/ui/field'
export * from './components/ui/form'
export * from './components/ui/hover-card'
export * from './components/ui/input-group'
export * from './components/ui/input-otp'
export * from './components/ui/input'
export * from './components/ui/item'
export * from './components/ui/kbd'
export * from './components/ui/label'
export * from './components/ui/menubar'
export * from './components/ui/native-select'
export * from './components/ui/navigation-menu'
export * from './components/ui/pagination'
export * from './components/ui/popover'
export * from './components/ui/progress'
export * from './components/ui/radio-group'
export * from './components/ui/resizable'
export * from './components/ui/scroll-area'
export * from './components/ui/select'
export * from './components/ui/separator'
export * from './components/ui/sheet'
export * from './components/ui/sidebar'
export * from './components/ui/skeleton'
export * from './components/ui/slider'
export * from './components/ui/sonner'
export * from './components/ui/spinner'
export * from './components/ui/switch'
export * from './components/ui/table'
export * from './components/ui/tabs'
export * from './components/ui/textarea'
export * from './components/ui/toggle-group'
export * from './components/ui/toggle'
export * from './components/ui/toolbar'
export * from './components/ui/tooltip'

// 2one-only components (no shadcn equivalent)
export * from './components/logo'
export * from './components/app-bar'
export * from './components/bottom-nav-item'
export * from './components/media-placeholder'
export * from './components/theme-toggle'
export * from './components/stat-tile'
export * from './components/data-table'

// Tier-3 page patterns — importable compositions. For a lean import that skips the
// rest of the barrel, use the subpath: '@2one/design-library/patterns/app-shell'.
// (Spec-only patterns — feed-item, profile-header, … — live in rules/patterns/.)
export * from './patterns/app-shell'
export * from './patterns/pricing-page'
export * from './patterns/marketing-site'

// Marketing section blocks — the sections a marketing site is built from. Exported
// so a site can compose them (and, via preserveModules, so each is reachable as a
// lean subpath import: '@2one/design-library/blocks/marketing/hero'). Named exports
// tree-shake, so importing one from the barrel does not pull the rest.
export * from './blocks/marketing/hero'
export * from './blocks/marketing/feature-grid'
export * from './blocks/marketing/stats'
export * from './blocks/marketing/pricing'
export * from './blocks/marketing/faq'
export * from './blocks/marketing/client-faq'
export * from './blocks/marketing/cta-banner'
export * from './blocks/marketing/logo-cloud'
export * from './blocks/marketing/testimonial'
export * from './blocks/marketing/footer'
export * from './blocks/marketing/page'
