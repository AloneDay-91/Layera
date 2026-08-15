"use client";

import { useState } from "react";
import { getInitials } from "@/lib/avatar";

export function UserAvatar({
  userId,
  name,
  size = 20,
}: {
  userId?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = userId && !failed ? `/api/profile/avatar?userId=${userId}` : null;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-info text-kumo-canvas"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
