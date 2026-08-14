import type { SVGProps } from "react";

export interface AppLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function AppLogo({ size = 28, className, ...props }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="FileCloud"
      className={className ?? "text-kumo-info"}
      {...props}
    >
      <path
        fill="currentColor"
        d="M28 75.5 75.5 28H128v76.5L80.5 152H28V75.5Zm100 0L175.5 28H228v76.5L180.5 152H128V75.5Zm-100 104L75.5 132H128v76.5L80.5 256H28v-76.5Zm100 0 47.5-47.5H228v76.5L180.5 256H128v-76.5Z"
      />
    </svg>
  );
}
