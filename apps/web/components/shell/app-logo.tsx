"use client";

import type { SVGProps } from "react";

export interface AppLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function AppLogo({ size = 28, className, ...props }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="logo-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        <linearGradient id="logo-grad-secondary" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        <linearGradient id="logo-grad-accent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>

      {/* Outer Isometric Hexagon Framework */}
      <path
        d="M20 3 L35 11.5 V28.5 L20 37 L5 28.5 V11.5 Z"
        fill="none"
        stroke="url(#logo-grad-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.3"
      />

      {/* Top Facet (Cube / Prism Face) */}
      <path
        d="M20 4 L33 11.5 L20 19 L7 11.5 Z"
        fill="url(#logo-grad-secondary)"
      />

      {/* Left Bottom Facet */}
      <path
        d="M7 13 L19 20 V34.5 L7 27.5 Z"
        fill="url(#logo-grad-primary)"
      />

      {/* Right Bottom Facet */}
      <path
        d="M33 13 L21 20 V34.5 L33 27.5 Z"
        fill="url(#logo-grad-accent)"
      />

      {/* Center AI Node Core */}
      <circle cx="20" cy="20" r="3.5" fill="#FFFFFF" />
      <circle cx="20" cy="20" r="1.5" fill="#3B82F6" />
    </svg>
  );
}
