// Loading visual: grey cloud silhouette with a 2s left-to-right white sweep.
// The sweep is a translating gradient overlay clipped to the cloud shape.
export function LoadingCloud({ size = 64 }: { size?: number }): JSX.Element {
  return (
    <div
      data-testid="icon-loading"
      data-loading-duration-ms="2000"
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label="Loading weather"
      >
        <defs>
          <clipPath id="loading-cloud-clip">
            <path d="M16 40 a8 8 0 0 1 0-16 a12 12 0 0 1 22-4 a10 10 0 0 1 10 18 z" />
          </clipPath>
          <linearGradient id="loading-sweep" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path
          d="M16 40 a8 8 0 0 1 0-16 a12 12 0 0 1 22-4 a10 10 0 0 1 10 18 z"
          fill="#6b7280"
        />
        <g clipPath="url(#loading-cloud-clip)">
          <rect
            data-testid="icon-loading-sweep"
            x="-64"
            y="0"
            width="64"
            height="64"
            fill="url(#loading-sweep)"
          >
            <animate
              attributeName="x"
              from="-64"
              to="64"
              dur="2s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      </svg>
    </div>
  );
}
