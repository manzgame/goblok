interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="currentColor" />
      <path d="M16 14.5h10.2c7.2 0 11.8 4.2 11.8 9.5s-4.6 9.5-11.8 9.5H16V29h10c4.1 0 6.6-1.9 6.6-5s-2.5-5-6.6-5h-4.8v5.2H16v-9.7Z" fill="var(--brand-cut, white)" />
      <path d="M23.7 22.2h5.2v10.1l3.3-3.2 3 3-8.9 8.4-8.7-8.4 3-3 3.1 3.1v-10Z" fill="var(--brand-cut, white)" />
    </svg>
  );
}
