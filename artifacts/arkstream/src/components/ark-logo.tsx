import { Link } from 'wouter';
import logoSrc from '../assets/arkstream-logo.png';

interface ArkLogoProps {
  size?: 'sm' | 'md' | 'lg';
  linkTo?: string | false;
}

/**
 * ArkStream image logo — transparent PNG, scales to navbar height.
 * sm → 33px, md → 39px, lg → 51px (maintenance page)
 */
export function ArkLogo({ size = 'md', linkTo = '/' }: ArkLogoProps) {
  const height = size === 'sm' ? 33 : size === 'lg' ? 51 : 39;

  const inner = (
    <img
      src={logoSrc}
      alt="ArkStream"
      style={{
        height,
        width: 'auto',
        display: 'block',
        userSelect: 'none',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    />
  );

  if (linkTo === false) return inner;
  return <Link href={linkTo as string}>{inner}</Link>;
}
