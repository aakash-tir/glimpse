// Loading visual: grey cloud silhouette that fills with white from left
// to right over 2s, then snaps back to grey and repeats. The fill is a
// solid white rectangle whose width grows 0 -> 64, clipped to the cloud
// shape. Snap-back is achieved by an instantaneous width reset at the
// end of each cycle (animate's natural repeat behavior).
export function LoadingCloud({ size = 64 }: { size?: number }): JSX.Element {
  const cloudPath =
    'M16 40 a8 8 0 0 1 0-16 a12 12 0 0 1 22-4 a10 10 0 0 1 10 18 z';
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
            <animate
              attributeName="width"
              from="0"
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
