import * as React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardHeader, CardDescription, CardTitle, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/*
  StatTile — a single KPI / metric tile (2one-authored). Promoted from the
  dashboard-plain block's section-cards so a dashboard can compose real tiles
  instead of re-deriving the shape each time.

  The trend delta uses the data-trend hues (success = growth, danger = decline)
  but is ALWAYS paired with a direction arrow, so meaning never rests on colour
  alone (rules: validation-only, no-color-alone). Value is tabular-nums.
*/
export interface StatTileProps extends React.ComponentProps<typeof Card> {
  /** The metric name, e.g. "Total Revenue". */
  label: string
  /** The metric value, e.g. "$1,250.00" (rendered tabular). */
  value: React.ReactNode
  /** Optional delta text, e.g. "+12.5%". */
  delta?: string
  /** Delta direction — pairs the colour with an arrow so it is never colour-alone. */
  trend?: 'up' | 'down'
  /** Optional bold footer line under the value. */
  footer?: React.ReactNode
  /** Optional muted hint under the footer. */
  hint?: React.ReactNode
}

export function StatTile({ label, value, delta, trend, footer, hint, className, ...props }: StatTileProps) {
  const Arrow = trend === 'down' ? TrendingDown : TrendingUp
  const tone = trend === 'down' ? 'text-danger' : 'text-success'
  return (
    <Card className={cn('@container/card', className)} {...props}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        {delta && (
          <CardAction>
            <Badge variant="outline" className={trend ? tone : undefined}>
              {trend && <Arrow />}
              {delta}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {(footer || hint) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {footer && (
            <div className="line-clamp-1 flex items-center gap-2 font-medium">
              {footer}
              {trend && <Arrow className={cn('size-4', tone)} />}
            </div>
          )}
          {hint && <div className="text-muted-foreground">{hint}</div>}
        </CardFooter>
      )}
    </Card>
  )
}
