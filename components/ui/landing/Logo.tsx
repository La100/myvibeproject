import React from 'react';
import Link from 'next/link';

const Logo = () => {
  return (
    <Link href="/" className="flex items-center gap-3 group" aria-label="Myvibe project">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold tracking-tight transition-transform duration-200 group-hover:-translate-y-0.5">
        VP
      </span>
      <span className="text-lg font-normal tracking-tight font-[var(--font-display-serif)] text-foreground group-hover:opacity-90 transition-opacity duration-200">
        Myvibe project
      </span>
    </Link>
  );
};

export default Logo;
