/**
 * Creel, 22 seconds, five beats: the notice, Record, the live count, Download ZIP,
 * the close. Every frame of the popup is a capture of the real UI; the video only
 * moves the camera and the pointer around it.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  BG,
  BRAND,
  Brand,
  Browser,
  Cursor,
  POPUP,
  Ring,
  Ripple,
  SitePage,
  Ui,
  WINDOW,
  ease,
  shot,
  visible,
  type Shot,
} from "./parts";

export const FPS = 30;
export const DURATION = 22 * FPS;

// Frames: when each popup state replaces the one before, and when each click lands.
const IDLE = 111;
const REC = 231;
const DONE = 390;
const CLOSE = 540;
const CLICKS = { accept: 105, record: 225, download: 465 };

export const BEATS: { from: number; caption: string }[] = [
  { from: 0, caption: "It says what it keeps, first." },
  { from: IDLE, caption: "Open a site. Press Record." },
  { from: REC + 30, caption: "Every JSON response, counted as it lands." },
  { from: DONE, caption: "Download it all as one ZIP." },
];

const STATES: { name: Shot; from: number }[] = [
  { name: "consent", from: 0 },
  { name: "idle", from: IDLE },
  { name: "rec", from: REC },
  { name: "done", from: DONE },
];

// Where the browser window sits on the 1920x1080 stage.
const VIEW = { x: 840, y: 80, width: 1000, height: 920 };
const FIT = VIEW.width / WINDOW.width;
// The camera: the world point at the centre of the view, and the scale there.
const WIDE = { s: FIT, x: WINDOW.width / 2, y: VIEW.height / FIT / 2 };
const CLOSE_UP = { s: FIT * 1.5, x: POPUP.x + 180, y: POPUP.y + 120 };

const center = (name: Shot, mark: string) => {
  const box = shot(name).marks[mark]!;
  return {
    x: POPUP.x + box.x + box.width / 2,
    y: POPUP.y + box.y + box.height / 2,
  };
};
const TARGETS = {
  accept: center("consent", "accept"),
  record: center("idle", "record"),
  download: center("done", "download"),
};

/** The pointer's path: it rests at each target until the next move starts. */
const PATH = [
  { f: 0, x: 120, y: 760 },
  { f: 60, ...TARGETS.accept },
  { f: IDLE + 20, ...TARGETS.record },
  { f: REC + 90, ...TARGETS.record },
  { f: DONE + 60, ...TARGETS.download },
];

const Caption = ({ frame }: { frame: number }) => {
  const beat = [...BEATS].reverse().find((b) => frame >= b.from);
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        top: 380,
        width: 660,
        fontSize: 80,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: "-0.03em",
        color: BRAND.onColor,
        opacity: visible(frame, beat?.from ?? 0, CLOSE, 10),
      }}
    >
      {beat?.caption}
    </div>
  );
};

export const Promo = () => {
  const frame = useCurrentFrame();
  const zoom = Math.min(
    ease(frame, [REC + 60, REC + 90], [0, 1]),
    1 - ease(frame, [DONE - 20, DONE + 10], [0, 1]),
  );
  const cam = (key: keyof typeof WIDE) =>
    WIDE[key] + (CLOSE_UP[key] - WIDE[key]) * zoom;
  const scale = cam("s");
  let at = PATH[0]!;
  let pointer = { x: at.x, y: at.y };
  for (const next of PATH.slice(1)) {
    if (frame >= at.f) {
      pointer = {
        x: ease(frame, [at.f, next.f], [at.x, next.x]),
        y: ease(frame, [at.f, next.f], [at.y, next.y]),
      };
    }
    at = next;
  }
  const world = 1 - ease(frame, [CLOSE - 10, CLOSE + 6], [0, 1]);
  const pressed = Object.values(CLICKS).some(
    (c) => frame >= c && frame < c + 4,
  );
  const rec = shot("rec").marks.list!;

  return (
    <AbsoluteFill style={BG}>
      <div
        style={{
          position: "absolute",
          left: VIEW.x,
          top: VIEW.y,
          width: VIEW.width,
          height: VIEW.height,
          overflow: "hidden",
          borderRadius: 24,
          background: BRAND.surface,
          opacity: world,
        }}
      >
        <div
          style={{
            position: "absolute",
            transformOrigin: "0 0",
            transform: `translate(${VIEW.width / 2 - cam("x") * scale}px, ${VIEW.height / 2 - cam("y") * scale}px) scale(${scale})`,
          }}
        >
          <Browser tab="Example Orders" url="www.example.com">
            <SitePage />
          </Browser>
          {STATES.map(({ name, from }, i) => {
            const until = STATES[i + 1]?.from;
            return (
              <Ui
                key={name}
                name={name}
                x={POPUP.x}
                y={POPUP.y}
                style={{
                  opacity: visible(frame, from === 0 ? -8 : from, until, 6),
                }}
              />
            );
          })}
          <Ring
            box={rec}
            at={POPUP}
            opacity={Math.min(
              visible(frame, REC + 90),
              1 - visible(frame, DONE - 10),
            )}
          />
          <Cursor {...pointer} scale={scale} pressed={pressed} opacity={1} />
          {Object.entries(CLICKS).map(([key, f]) => (
            <Ripple
              key={key}
              x={TARGETS[key as keyof typeof TARGETS].x}
              y={TARGETS[key as keyof typeof TARGETS].y}
              t={frame - f}
              scale={scale}
            />
          ))}
        </div>
      </div>
      <Caption frame={frame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeContent: "center",
          justifyItems: "center",
          gap: 32,
          opacity: visible(frame, CLOSE + 6),
        }}
      >
        <Brand size={96} />
        <div style={{ fontSize: 48, color: BRAND.onColor }}>
          API Response Recorder
        </div>
        <div style={{ fontSize: 40, color: BRAND.onColor }}>
          Add to your browser. Free.
        </div>
      </div>
    </AbsoluteFill>
  );
};
