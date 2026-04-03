import logoDark from '../assets/posetiv-logo-dark.png';
import logoWhite from '../assets/posetiv-logo-white.png';

interface PosetivLogoProps {
  variant?: 'dark' | 'light';
  height?: number;
}

export default function PosetivLogo({ variant = 'dark', height = 32 }: PosetivLogoProps) {
  const src = variant === 'dark' ? logoDark : logoWhite;
  return (
    <img
      src={src}
      alt="Posetiv"
      height={height}
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}
