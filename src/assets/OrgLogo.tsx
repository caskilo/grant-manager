interface OrgLogoProps {
  size?: number;
  className?: string;
  logoUrl?: string;
  brandColours?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

/**
 * Organisation Logo — renders the org's uploaded logo when `logoUrl` is set,
 * otherwise falls back to the Crow's Nest mark tinted with `brandColours`
 * (defaulting to the Odyssean palette).
 */
export default function OrgLogo({
  size = 40,
  className = '',
  logoUrl,
  brandColours,
}: OrgLogoProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Organisation logo"
        width={size}
        height={size}
        className={className}
        style={{
          objectFit: 'contain',
          borderRadius: 4,
          filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))',
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  const cPrimary = brandColours?.primary || '#2874A6';
  const cAccent = brandColours?.accent || '#5DADE2';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    >
      {/* Crow's nest */}
      <ellipse cx="20" cy="22" rx="10" ry="6" fill="none" stroke={cAccent} strokeWidth="2" />
      {/* Support ropes */}
      <line x1="10" y1="22" x2="8" y2="32" stroke={cAccent} strokeWidth="2.5" opacity="0.7" />
      <line x1="30" y1="22" x2="32" y2="32" stroke={cAccent} strokeWidth="2.5" opacity="0.7" />
      {/* Horizon/search arc */}
      <path
        d="M8 14 Q20 8 32 14"
        fill="none"
        stroke={cPrimary}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* The spotter/dot on horizon */}
      <circle cx="20" cy="11" r="2" fill={cPrimary} />
    </svg>
  );
}
