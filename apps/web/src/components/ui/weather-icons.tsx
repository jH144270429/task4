import type { ReactNode } from "react";

export type WeatherIconProps = {
  weatherCode: number | null | undefined;
  isDay?: boolean | null | undefined;
  className?: string;
};

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className ?? "h-5 w-5"}
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

function IconSun({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4 12H2" />
      <path d="M22 12h-2" />
      <path d="m5 5 1.4 1.4" />
      <path d="m17.6 17.6 1.4 1.4" />
      <path d="m19 5-1.4 1.4" />
      <path d="m6.4 17.6-1.4 1.4" />
    </Svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 14.2A7.5 7.5 0 0 1 9.8 3a6 6 0 1 0 11.2 11.2Z" />
    </Svg>
  );
}

function IconCloud({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8.5 18h9.2A4.3 4.3 0 0 0 18 9.5a5.5 5.5 0 0 0-10.7 1.6A3.8 3.8 0 0 0 8.5 18Z" />
    </Svg>
  );
}

function IconRain({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7.8 14.5h10A3.7 3.7 0 0 0 18 7.2a5 5 0 0 0-9.7 1.5A3.2 3.2 0 0 0 7.8 14.5Z" />
      <path d="M8 17l-1 2" />
      <path d="M12 17l-1 2" />
      <path d="M16 17l-1 2" />
    </Svg>
  );
}

function IconSnow({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7.8 14.5h10A3.7 3.7 0 0 0 18 7.2a5 5 0 0 0-9.7 1.5A3.2 3.2 0 0 0 7.8 14.5Z" />
      <path d="M9 17h0" />
      <path d="M12 18.5h0" />
      <path d="M15 17h0" />
    </Svg>
  );
}

function IconThunder({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7.8 14.5h10A3.7 3.7 0 0 0 18 7.2a5 5 0 0 0-9.7 1.5A3.2 3.2 0 0 0 7.8 14.5Z" />
      <path d="M12 14l-2 4h2l-1.2 4L15 17h-2l2-3h-3Z" />
    </Svg>
  );
}

function IconFog({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7.8 11.5h10A3.7 3.7 0 0 0 18 4.2a5 5 0 0 0-9.7 1.5A3.2 3.2 0 0 0 7.8 11.5Z" />
      <path d="M4 15h16" />
      <path d="M6 18h12" />
    </Svg>
  );
}

function IconWind({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M3 10h10a2 2 0 1 0-2-2" />
      <path d="M3 14h14a2 2 0 1 1-2 2" />
      <path d="M3 18h8" />
    </Svg>
  );
}

function normalize(code: number) {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "rain";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "wind";
}

export function WeatherIcon({ weatherCode, isDay, className }: WeatherIconProps) {
  if (weatherCode == null) return <IconCloud className={className} />;
  const kind = normalize(weatherCode);
  if (kind === "clear") {
    return isDay === false ? (
      <IconMoon className={className} />
    ) : (
      <IconSun className={className} />
    );
  }
  if (kind === "cloud") return <IconCloud className={className} />;
  if (kind === "fog") return <IconFog className={className} />;
  if (kind === "rain") return <IconRain className={className} />;
  if (kind === "snow") return <IconSnow className={className} />;
  if (kind === "thunder") return <IconThunder className={className} />;
  return <IconWind className={className} />;
}

