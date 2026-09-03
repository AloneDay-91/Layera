import Image from "next/image";
import { cn } from "@/lib/utils";

const BACKDROP_SRC = "/product/hero-backdrop.jpg";

type SharedProps = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

type FillFrameProps = SharedProps & {
  fill: true;
};

type SizedFrameProps = SharedProps & {
  fill?: false;
  width: number;
  height: number;
};

export function MediaFrame(props: FillFrameProps | SizedFrameProps) {
  const { src, alt, sizes, priority = false, className } = props;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={BACKDROP_SRC}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority}
      />
      {props.fill ? (
        <div className="absolute inset-4 sm:inset-8">
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            className="rounded-md object-cover shadow-lg"
            priority={priority}
          />
        </div>
      ) : (
        <div className="relative p-4 sm:p-8">
          <Image
            src={src}
            alt={alt}
            width={props.width}
            height={props.height}
            sizes={sizes}
            className="h-auto w-full rounded-md object-cover shadow-lg"
            priority={priority}
          />
        </div>
      )}
    </div>
  );
}
