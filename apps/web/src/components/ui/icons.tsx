import type { ReactNode } from "react";

export type IconProps = {
  className?: string;
};

function BaseIcon({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 13.5V6.8A2.8 2.8 0 0 1 6.8 4h3.7v9.5H4Z" />
      <path d="M13.5 20V4h3.7A2.8 2.8 0 0 1 20 6.8V20h-6.5Z" />
      <path d="M4 20h6.5v-4.5H4V20Z" />
    </BaseIcon>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
      <path d="M12 10.5a2.5 2.5 0 1 0 0-.01Z" />
    </BaseIcon>
  );
}

export function IconCompare(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 4H6.8A2.8 2.8 0 0 0 4 6.8V20h6V4Z" />
      <path d="M20 20V6.8A2.8 2.8 0 0 0 17.2 4H14v16h6Z" />
      <path d="M7 9h0" />
      <path d="M17 12h0" />
    </BaseIcon>
  );
}

export function IconBell(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" />
      <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
    </BaseIcon>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 12a7.8 7.8 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a8.5 8.5 0 0 0-1.7-1l-.4-2.6H9.2L8.8 6a8.5 8.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.8 7.8 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8.5 8.5 0 0 0 1.7 1l.4 2.6h5.6l.4-2.6a8.5 8.5 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.6.1-1Z" />
    </BaseIcon>
  );
}

export function IconThermometer(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M14 14.8V5.5a2 2 0 0 0-4 0v9.3a3.5 3.5 0 1 0 4 0Z" />
      <path d="M12 9v6" />
    </BaseIcon>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M4.5 9h15" />
      <path d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v11A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 19V8a2.5 2.5 0 0 1 2.5-2.5Z" />
    </BaseIcon>
  );
}

export function IconTrend(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 16l6-6 4 4 6-6" />
      <path d="M20 8v6h-6" />
    </BaseIcon>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z" />
      <path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </BaseIcon>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 2l1.2 3.8L17 7l-3.8 1.2L12 12l-1.2-3.8L7 7l3.8-1.2L12 2Z" />
      <path d="M19 12l.8 2.4L22 15l-2.2.6L19 18l-.8-2.4L16 15l2.2-.6L19 12Z" />
      <path d="M4.5 13l.7 2.1L7 15.5l-1.8.5L4.5 18l-.7-2-1.8-.5 1.8-.4.7-2.1Z" />
    </BaseIcon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <path d="M16.2 16.2 21 21" />
    </BaseIcon>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function IconStar(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.2 14.6 8.5l5.9.9-4.2 4.1 1 5.9L12 16.7 6.7 19.4l1-5.9-4.2-4.1 5.9-.9L12 3.2Z" />
    </BaseIcon>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 4h6" />
      <path d="M10 4 10.6 3h2.8L14 4" />
      <path d="M6 7h12" />
      <path d="M8 7l1 14h6l1-14" />
      <path d="M10.5 10.2v7.3" />
      <path d="M13.5 10.2v7.3" />
    </BaseIcon>
  );
}
