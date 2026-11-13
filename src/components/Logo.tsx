export function Monogram({ size = 40, radius }: { size?: number; radius?: number }) {
  const r = radius ?? Math.round(size * 0.27);
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-label="NsPace">
      <defs>
        <linearGradient id="nsg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A84FF" />
          <stop offset="0.55" stopColor="#007AFF" />
          <stop offset="1" stopColor="#5E5CE6" />
        </linearGradient>
        <linearGradient id="nss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx={(r / size) * 512} fill="url(#nsg)" />
      <rect
        x="1"
        y="1"
        width="510"
        height="510"
        rx={(r / size) * 512}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <path
        d="M0 150 Q0 0 150 0 H362 Q512 0 512 150 V186 H0 Z"
        fill="url(#nss)"
        opacity="0.85"
      />
      <path
        d="M150 372V172h44l124 128V172h44v200h-44L194 244v128z"
        fill="#fff"
      />
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <span className="ns">Ns</span>
      <span className="pace">Pace</span>
      <span className="dot" />
    </span>
  );
}
