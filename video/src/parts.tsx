/**
 * The pieces around the real UI: the browser, the cursor, the ring. Sizes are
 * world pixels (the extension's CSS pixels); the camera scales the world.
 */
import type { CSSProperties, ReactNode } from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";
import captures from "../public/captures.json";

export const BRAND = {
  name: "Creel",
  /** Copied into public/ by e2e/video.spec.ts. */
  mark: "mark.png",
  from: "#0f766e",
  to: "#042f2e",
  accent: "#2dd4bf",
  onColor: "#ffffff",
  surface: "#ffffff",
  chrome: "#e2e8f0",
  field: "#f1f5f9",
  muted: "#475569",
  ink: "#0f172a",
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export type Shot = keyof typeof captures;
export type Box = { x: number; y: number; width: number; height: number };

export const shot = (name: Shot) =>
  captures[name] as {
    width: number;
    height: number;
    marks: Record<string, Box>;
  };

/** Eased and clamped: every move starts and lands softly. */
export const ease = (
  frame: number,
  [f0, f1]: [number, number],
  [v0, v1]: [number, number],
) =>
  interpolate(frame, [f0, f1], [v0, v1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 0 before `inAt`, 1 from then on, and 0 after `outAt` if given; `fade`-frame edges. */
export const visible = (
  frame: number,
  inAt: number,
  outAt?: number,
  fade = 8,
) => {
  const shown = ease(frame, [inAt, inAt + fade], [0, 1]);
  return outAt === undefined
    ? shown
    : Math.min(shown, ease(frame, [outAt - fade, outAt], [1, 0]));
};

// Browser geometry, in world pixels.
export const WINDOW = { width: 760, height: 1000 };
const TABS = 46;
export const CONTENT_TOP = 106;
export const ACTION = { x: WINDOW.width - 56, y: TABS + 30 };
/** A browser hangs a popup under the toolbar, its right edge near the button. */
export const POPUP = { x: ACTION.x + 28 - 360, y: CONTENT_TOP + 2 };

export const BG: CSSProperties = {
  background: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to} 85%)`,
  fontFamily: FONT,
};

export const Brand = ({ size }: { size: number }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: size * 0.4,
      fontSize: size,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: BRAND.onColor,
    }}
  >
    <Img src={staticFile(BRAND.mark)} style={{ width: size * 1.3 }} />
    {BRAND.name}
  </div>
);

export const Browser = ({
  tab,
  url,
  children,
}: {
  tab: string;
  url: string;
  children: ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      width: WINDOW.width,
      height: WINDOW.height,
      overflow: "hidden",
      background: BRAND.surface,
    }}
  >
    <div
      style={{
        height: TABS,
        display: "flex",
        alignItems: "flex-end",
        paddingLeft: 18,
        background: BRAND.chrome,
      }}
    >
      <div
        style={{
          width: 240,
          padding: "11px 18px",
          borderRadius: "12px 12px 0 0",
          background: BRAND.surface,
          fontSize: 16,
          color: BRAND.muted,
        }}
      >
        {tab}
      </div>
    </div>
    <div
      style={{
        height: CONTENT_TOP - TABS,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 20px",
        borderBottom: `1px solid ${BRAND.chrome}`,
      }}
    >
      <div
        style={{
          flex: 1,
          padding: "9px 22px",
          borderRadius: 999,
          background: BRAND.field,
          fontSize: 19,
          color: BRAND.muted,
        }}
      >
        {url}
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          marginRight: 16,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          boxShadow: `0 0 0 3px ${BRAND.accent}`,
        }}
      >
        <Img src={staticFile(BRAND.mark)} style={{ width: 26 }} />
      </div>
    </div>
    {children}
  </div>
);

/** A capture of the real UI, placed 1:1 in world pixels. */
export const Ui = ({
  name,
  x,
  y,
  style,
}: {
  name: Shot;
  x: number;
  y: number;
  style?: CSSProperties;
}) => {
  const { width, height } = shot(name);
  return (
    <Img
      src={staticFile(`${name}.png`)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 10,
        boxShadow: "0 20px 50px rgb(0 0 0 / 0.25)",
        ...style,
      }}
    />
  );
};

/** The page behind the popup: a site, as blocks. */
export const SitePage = () => (
  <div
    style={{
      position: "absolute",
      top: CONTENT_TOP + 48,
      left: 48,
      width: 600,
      display: "grid",
      gap: 22,
    }}
  >
    {[420, 540, 500, 520, 380].map((width, i) => (
      <i
        key={width}
        style={{
          height: i === 0 ? 44 : 16,
          width,
          borderRadius: 6,
          background: BRAND.chrome,
        }}
      />
    ))}
  </div>
);

/** Outline around the part of the UI a caption talks about. */
export const Ring = ({
  box,
  at,
  opacity,
}: {
  box: Box;
  at: { x: number; y: number };
  opacity: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: at.x + box.x - 8,
      top: at.y + box.y - 4,
      width: box.width + 16,
      height: box.height + 8,
      borderRadius: 10,
      boxShadow: `0 0 0 3px ${BRAND.accent}`,
      opacity,
    }}
  />
);

/** The pointer, kept the same size on screen whatever the camera scale. */
export const Cursor = ({
  x,
  y,
  scale,
  pressed,
  opacity,
}: {
  x: number;
  y: number;
  scale: number;
  pressed: boolean;
  opacity: number;
}) => (
  <svg
    width="28"
    height="36"
    viewBox="0 0 28 36"
    style={{
      position: "absolute",
      left: x,
      top: y,
      transformOrigin: "0 0",
      transform: `scale(${(pressed ? 0.85 : 1) / scale})`,
      opacity,
    }}
  >
    <path
      d="M2 2 L2 28 L9 21 L14 33 L19 31 L14 19 L24 19 Z"
      style={{
        fill: BRAND.surface,
        stroke: BRAND.ink,
        strokeWidth: 2,
        strokeLinejoin: "round",
      }}
    />
  </svg>
);

/** The ripple of a click, `t` frames after it. */
export const Ripple = ({
  x,
  y,
  t,
  scale,
}: {
  x: number;
  y: number;
  t: number;
  scale: number;
}) => {
  if (t < 0 || t > 14) {
    return null;
  }
  const r = interpolate(t, [0, 14], [6, 40]) / scale;
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `${3 / scale}px solid ${BRAND.accent}`,
        opacity: interpolate(t, [0, 14], [0.9, 0]),
      }}
    />
  );
};
