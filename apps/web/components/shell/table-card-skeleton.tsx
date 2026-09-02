"use client";

import { LayerCard, SkeletonLine, Table } from "@cloudflare/kumo";

function Pulse({ width, className = "h-4" }: { width: number; className?: string }) {
  return (
    <SkeletonLine
      minWidth={width}
      maxWidth={width}
      minDuration={1.5}
      maxDuration={1.5}
      minDelay={0}
      maxDelay={0}
      className={className}
    />
  );
}

export function TableCardSkeleton({
  columns,
  rows = 6,
  ring = false,
}: {
  columns: string[];
  rows?: number;
  ring?: boolean;
}) {
  return (
    <LayerCard className={ring ? "border border-kumo-line p-0 ring-1 ring-kumo-fill" : "p-0"}>
      <Table className={ring ? "min-w-208" : undefined}>
        <Table.Header>
          <Table.Row>
            {columns.map((column, index) => (
              <Table.Head key={`${column}-${index}`} className={index === columns.length - 1 ? "text-right" : undefined}>
                {column || " "}
              </Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: rows }).map((_, row) => (
            <Table.Row key={row}>
              {columns.map((_, col) => (
                <Table.Cell key={`${row}-${col}`} className={col === columns.length - 1 ? "text-right" : undefined}>
                  <div className="flex items-center gap-2">
                    {col === 0 && ring ? <Pulse width={10} className="h-5 w-5" /> : null}
                    <Pulse width={col === 0 ? 48 : 22} />
                  </div>
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

export { Pulse };
