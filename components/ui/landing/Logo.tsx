import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

const Logo = ({ className }: LogoProps) => {
  return (
    <Link href="/" className="group inline-flex items-center" aria-label="Myvibe project">
      <Image
        src="/logo.svg"
        alt="Myvibe project"
        width={1136}
        height={1136}
        className={cn(
          "size-12 transition-opacity duration-200 group-hover:opacity-90 sm:size-14",
          className
        )}
      />
    </Link>
  );
};

export default Logo;
