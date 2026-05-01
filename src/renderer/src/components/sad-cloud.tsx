// Sad-cloud silhouette used by the icon's error state. Cloud shape matches
// the loading visual so the two states feel related; small frowning eyes +
// downturned mouth differentiate it.
export function SadCloud({ size = 64 }: { size?: number }): JSX.Element {
  return (
    <svg
      data-testid="icon-sad-cloud"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Weather could not be determined"
    >
      <path
        d="M16 40 a8 8 0 0 1 0-16 a12 12 0 0 1 22-4 a10 10 0 0 1 10 18 z"
        fill="#9ca3af"
      />
      <circle cx="26" cy="29" r="1.6" fill="#1f2937" />
      <circle cx="38" cy="29" r="1.6" fill="#1f2937" />
      <path
        d="M26 35 q6 -4 12 0"
        stroke="#1f2937"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
