interface PosetivLogoProps {
  variant?: 'dark' | 'light';
  height?: number;
}

export default function PosetivLogo({ variant = 'dark', height = 32 }: PosetivLogoProps) {
  const textColor = variant === 'dark' ? '#2d2d2d' : '#ffffff';
  const scale = height / 40;

  return (
    <svg
      viewBox="0 0 200 48"
      height={height}
      style={{ display: 'block' }}
      aria-label="Posetiv"
    >
      {/* Wordmark */}
      <text
        x="0"
        y="38"
        fontFamily="'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"
        fontWeight="700"
        fontSize="42"
        letterSpacing="-1"
        fill={textColor}
      >
        posetiv
      </text>
      {/* Green cloud with + */}
      <g transform="translate(163, 2)">
        <path
          d="M16 4c-4.4 0-8 3.1-8.9 7.2C3.3 12 0 15.7 0 20.2c0 5 4 9 9 9h18c4.4 0 8-3.6 8-8 0-3.8-2.7-7-6.2-7.8C28.1 8.2 23.3 4 18 4h-2z"
          fill="#6BBE49"
        />
        <line x1="17" y1="14" x2="17" y2="24" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="12" y1="19" x2="22" y2="19" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
