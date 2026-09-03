"use client";

import type { ReactNode } from "react";
import { LayerCard, Table, Text } from "@cloudflare/kumo";

export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Body>{children}</Table.Body>
      </Table>
    </LayerCard>
  );
}

export function SettingsItem({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Table.Row>
      <Table.Cell>
        <div className="grid max-w-lg gap-1.5 py-1">
          <Text as="span">{label}</Text>
          {description ? (
            <Text as="span" variant="secondary">
              {description}
            </Text>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell className="w-[min(20rem,42%)]">
        <div className="flex justify-end">{children}</div>
      </Table.Cell>
    </Table.Row>
  );
}
