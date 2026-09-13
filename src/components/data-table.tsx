'use client'

import * as React from 'react'
import {
  tableFeatures,
  rowSortingFeature,
  createSortedRowModel,
  createColumnHelper,
  useTable,
  FlexRender,
  type SortingState,
} from '@tanstack/react-table'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/*
  DataTable — a generic, sortable table (2one-authored). Promoted from the
  dashboard-plain block so any surface can render a typed table from the DLS Table
  primitive without re-wiring TanStack each time. Header + cells render through the
  real Table primitive, so it stays token-only and on-theme.

  Build columns with `dataTableColumns<Row>()` (a TanStack column helper bound to this
  table's features), then pass them in.
*/
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
})

/** A column helper bound to DataTable's feature set. `const col = dataTableColumns<Row>()`. */
export const dataTableColumns = <TData extends Record<string, unknown>>() => createColumnHelper<typeof features, TData>()

type Columns<TData extends Record<string, unknown>> = ReturnType<ReturnType<typeof dataTableColumns<TData>>['columns']>

export interface DataTableProps<TData extends Record<string, unknown>> {
  columns: Columns<TData>
  data: TData[]
}

export function DataTable<TData extends Record<string, unknown>>({ columns, data }: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>{header.isPlaceholder ? null : <FlexRender header={header} />}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
