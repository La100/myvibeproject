import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Logo = () => {
  return (
    <Link href="/" className="group inline-flex items-center" aria-label="Myvibe project">
      <Image
        src="/logo.svg"
        alt="Myvibe project"
        width={520}
        height={128}
        className="h-8 w-auto transition-opacity duration-200 group-hover:opacity-90 sm:h-9"
      />
    </Link>
  );
};

export default Logo;
