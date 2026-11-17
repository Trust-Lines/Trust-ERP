// Figma "lucide/monitor-pc". Not in lucide-react, so drawn here on the same 24px grid with a 2px
// stroke and round caps; stroke follows currentColor like the other icons.
export function MonitorPcIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 15H4C3.46957 15 2.96086 14.7893 2.58579 14.4142C2.21071 14.0391 2 13.5304 2 13V7C2 6.46957 2.21071 5.96086 2.58579 5.58579C2.96086 5.21071 3.46957 5 4 5H10M10 19H5M14 11H22M14 7H22M18 17H18.01M9 19V15M15 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H15C14.4477 21 14 20.5523 14 20V4C14 3.44772 14.4477 3 15 3Z" />
    </svg>
  );
}
