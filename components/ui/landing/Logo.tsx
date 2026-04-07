import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  containerClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

const Logo = ({
  className,
  containerClassName,
  showWordmark = false,
  wordmarkClassName,
}: LogoProps) => {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-3", containerClassName)}
      aria-label="Myvibe Project"
    >
      <Image
        src="/logo.svg"
        alt="Myvibe Project"
        width={1024}
        height={1024}
        className={cn(
          "size-12 transition-opacity duration-200 group-hover:opacity-90 sm:size-14",
          className
        )}
      />
      {showWordmark ? (
        <span
          className={cn(
            "flex items-baseline gap-x-3 whitespace-nowrap text-foreground transition-opacity duration-200 group-hover:opacity-90",
            wordmarkClassName
          )}
        >
          <span className="font-[var(--font-display-serif)] text-[0.98em] font-medium leading-[0.86] tracking-[-0.065em]">
            Myvibe
          </span>
          <span className="font-sans font-normal leading-[0.9] tracking-[-0.03em]">Project</span>
        </span>
      ) : null}
    </Link>
  );
};

export default Logo;
