"use client";

import { Empty } from "@cloudflare/kumo";
import type { Icon } from "@phosphor-icons/react";

export function ComingSoon({
  icon: IconComponent,
  title,
  description,
}: {
  icon: Icon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty icon={<IconComponent size={40} />} title={title} description={description} />
    </div>
  );
}
