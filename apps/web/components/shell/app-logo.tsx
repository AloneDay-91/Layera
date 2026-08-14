import { useId } from "react";
import type { SVGProps } from "react";

export interface AppLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function AppLogo({ size = 28, className, ...props }: AppLogoProps) {
  const gradientId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Layera"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-kumo-brand), white 15%)" />
          <stop offset="100%" stopColor="var(--color-kumo-brand)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M28 75.5 75.5 28H128v76.5L80.5 152H28V75.5Zm100 0L175.5 28H228v76.5L180.5 152H128V75.5Zm-100 104L75.5 132H128v76.5L80.5 256H28v-76.5Zm100 0 47.5-47.5H228v76.5L180.5 256H128v-76.5Z"
      />
    </svg>
  );
}
