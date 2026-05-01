// Loading visual: grey cloud silhouette that fills with white from left
// to right over 2s, then fades white -> grey over 0.5s, then repeats.
// Total cycle: 2.5s. The fill is a solid white rectangle clipped to the
// cloud shape; both `width` and `opacity` are driven by SMIL <animate>
// elements that share the 2.5s cycle so they stay in lockstep.
export function LoadingCloud({ size = 64 }: { size?: number }): JSX.Element {
  const cloudPath =
    'M16 40 a8 8 0 0 1 0-16 a12 12 0 0 1 22-4 a10 10 0 0 1 10 18 z';
  return (
    <div
      data-testid="icon-loading"
      data-loading-duration-ms="2000"
      data-fade-duration-ms="500"
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
            <path d={cloudPath} />
          </clipPath>
        </defs>
        <path d={cloudPath} fill="#6b7280" />
        <g clipPath="url(#loading-cloud-clip)">
          <rect
            data-testid="icon-loading-sweep"
            x="0"
            y="0"
            width="0"
            height="64"
            fill="white"
          >
            {/* width: 0 -> 64 over the first 2s, then holds 64 for 0.5s */}
            <animate
              attributeName="width"
              values="0; 64; 64"
              keyTimes="0; 0.8; 1"
              dur="2.5s"
              repeatCount="indefinite"
            />
            {/* opacity: stays 1 for the first 2s, then fades 1 -> 0 over 0.5s */}
            <animate
              attributeName="opacity"
              values="1; 1; 0"
              keyTimes="0; 0.8; 1"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      </svg>
    </div>
  );
}
