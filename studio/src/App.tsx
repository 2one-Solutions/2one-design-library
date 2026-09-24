import * as React from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, RotateCcw, Save, Undo2, History } from 'lucide-react'
import graph from '../../graph.json'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import { usePayload } from './payload-context'

const SWATCHES = [
  ['--background', 'Background'], ['--foreground', 'Foreground'], ['--primary', 'Primary'], ['--brand', 'Brand accent'],
  ['--muted', 'Muted'], ['--border', 'Border'], ['--destructive', 'Destructive'], ['--success', 'Success'],
  ['--chart-1', 'Chart 1'], ['--chart-2', 'Chart 2'], ['--chart-3', 'Chart 3'], ['--chart-4', 'Chart 4'], ['--chart-5', 'Chart 5'],
] as const

// The library's own components, shared by every client. Read from the graph so the list cannot drift.
const LIBRARY_COMPONENTS = (graph.nodes as { type: string; label?: string }[])
  .filter((n) => n.type === 'component' || n.type === 'component-2one')
  .map((n) => n.label ?? '')
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b))

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
      {dark ? <Sun /> : <Moon />} {dark ? 'Light' : 'Dark'}
    </Button>
  )
}

function Hero() {
  const { payload } = usePayload()
  return (
    <section className="space-y-4" aria-labelledby="hero-title">
      <p className="text-sm text-muted-foreground">Design language system</p>
      <h1 id="hero-title" className="text-4xl font-bold sm:text-5xl">{payload.brand.name}</h1>
      {payload.brand.tagline && <p className="max-w-prose text-lg text-muted-foreground">{payload.brand.tagline}</p>}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button>Get started</Button>
        <Button variant="outline">Read the guidelines</Button>
      </div>
    </section>
  )
}

function Tokens() {
  return (
    <section className="space-y-4" aria-labelledby="tokens-title">
      <h2 id="tokens-title" className="text-2xl font-semibold">Colour</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SWATCHES.map(([token, label]) => (
          <li key={token} className="space-y-1.5">
            <div className="h-14 rounded-md border" style={{ background: `var(${token})` }} />
            <p className="text-sm font-medium">{label}</p>
            <p className="font-mono text-xs text-muted-foreground">{token}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Components() {
  const { payload } = usePayload()
  const custom = payload.components?.custom ?? []
  return (
    <section className="space-y-4" aria-labelledby="components-title">
      <h2 id="components-title" className="text-2xl font-semibold">Components</h2>
      <p className="text-muted-foreground">
        {LIBRARY_COMPONENTS.length} shared components come with every design system. {custom.length ? `${custom.length} of your own are described below.` : 'Your own components are described in the payload and listed here.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {LIBRARY_COMPONENTS.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
      </div>
      {custom.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {custom.map((c) => (
            <Card key={c.name}>
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
              {(c.guidance || c.props?.length) && (
                <CardContent className="space-y-2 text-sm">
                  {c.guidance && <p>{c.guidance}</p>}
                  {c.props?.map((p) => (
                    <p key={p.name} className="font-mono text-xs text-muted-foreground">{p.name}: {p.type}</p>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

function Voice() {
  const { payload } = usePayload()
  const { voice, tone, mission, vision } = payload.brand
  if (!voice && !tone && !mission && !vision) return null
  return (
    <section className="space-y-4" aria-labelledby="voice-title">
      <h2 id="voice-title" className="text-2xl font-semibold">Brand</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {mission && <Card><CardHeader><CardDescription>Mission</CardDescription><CardTitle className="text-base font-medium">{mission}</CardTitle></CardHeader></Card>}
        {vision && <Card><CardHeader><CardDescription>Vision</CardDescription><CardTitle className="text-base font-medium">{vision}</CardTitle></CardHeader></Card>}
        {voice && <Card><CardHeader><CardDescription>Voice</CardDescription><CardTitle className="text-base font-medium">{voice.descriptors.join(', ')}</CardTitle></CardHeader>{voice.note && <CardContent className="text-sm text-muted-foreground">{voice.note}</CardContent>}</Card>}
        {tone && <Card><CardHeader><CardDescription>Tone</CardDescription><CardTitle className="text-base font-medium">{tone.descriptors.join(', ')}</CardTitle></CardHeader>{tone.note && <CardContent className="text-sm text-muted-foreground">{tone.note}</CardContent>}</Card>}
      </div>
    </section>
  )
}

function Editor() {
  const { draftText, setDraftText, errors, dirty, save, discard, reset, history, restore } = usePayload()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your payload</CardTitle>
        <CardDescription>Edits preview live. Nothing is kept until you save.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="history"><History /> History{history.length ? ` (${history.length})` : ''}</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="space-y-3">
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              spellCheck={false}
              aria-label="Payload JSON"
              aria-invalid={errors.length > 0}
              className="h-[28rem] font-mono text-xs"
            />
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>{errors.length === 1 ? 'This edit cannot be applied' : `${errors.length} problems with this edit`}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
                    {errors.length > 5 && <li>and {errors.length - 5} more</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save('manual edit')} disabled={!dirty || errors.length > 0}><Save /> Save</Button>
              <Button variant="outline" onClick={discard} disabled={!dirty}><Undo2 /> Discard</Button>
              <Button variant="ghost" onClick={reset}><RotateCcw /> Reset to 2one</Button>
            </div>
          </TabsContent>
          <TabsContent value="history" className="space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">No saved changes yet.</p>}
            {history.map((h, i) => (
              <div key={h.at} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{h.note}</p>
                  <p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString()} · {h.payload.brand.name}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => restore(i)}>Restore</Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export function App() {
  const { payload } = usePayload()
  React.useEffect(() => { document.title = `${payload.brand.name} design system` }, [payload.brand.name])
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <span className="font-[family-name:var(--font-heading)] text-lg font-bold">{payload.brand.name}</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-12">
          <Hero />
          <Separator />
          <Tokens />
          <Separator />
          <Components />
          <Separator />
          <Voice />
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Payload editor">
          <Editor />
        </aside>
      </main>
    </div>
  )
}
