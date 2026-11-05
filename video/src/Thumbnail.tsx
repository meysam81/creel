/**
 * The YouTube thumbnail, which the store shows as the listing's first slide:
 * YouTube's 480x360 copy, cropped to fit, under a play button at the centre. So
 * the headline is large and the centre stays empty. Check it at 480x270.
 */
import { AbsoluteFill } from "remotion";
import { BG, BRAND, Brand, Ui, shot } from "./parts";

const HEADLINE = "Record a site's JSON API responses";
const ZOOM = 1.5;

export const Thumbnail = () => {
  const { width } = shot("rec");
  return (
    <AbsoluteFill style={BG}>
      <div style={{ position: "absolute", left: 64, top: 64 }}>
        <Brand size={30} />
      </div>
      <h1
        style={{
          position: "absolute",
          left: 64,
          top: 196,
          width: 530,
          margin: 0,
          fontSize: 80,
          lineHeight: 1.02,
          letterSpacing: "-0.04em",
          fontWeight: 700,
          color: BRAND.onColor,
        }}
      >
        {HEADLINE}
      </h1>
      <div
        style={{
          position: "absolute",
          right: 48,
          top: 120,
          width: width * ZOOM,
          height: 480,
          overflow: "hidden",
          borderRadius: 18,
          background: BRAND.surface,
        }}
      >
        <Ui
          name="rec"
          x={0}
          y={0}
          style={{
            transform: `scale(${ZOOM})`,
            transformOrigin: "0 0",
            boxShadow: "none",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
