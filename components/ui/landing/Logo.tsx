/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BrandWordmark } from '@/components/ui/brand/BrandWordmark';

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
      <img
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
        <BrandWordmark
          className={cn(
            "flex items-baseline gap-x-3 whitespace-nowrap text-foreground transition-opacity duration-200 group-hover:opacity-90",
            wordmarkClassName
          )}
        />
      ) : null}
    </Link>
  );
};

export default Logo;
