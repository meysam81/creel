import { Composition, Still } from "remotion";
import { DURATION, FPS, Promo } from "./Promo";
import { Thumbnail } from "./Thumbnail";

export const Root = () => (
  <>
    {/* Laid out at 1080p; `bun run render` renders it at 2x, 4K. */}
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    {/* The store shows YouTube's thumbnail as the listing's first slide. */}
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
  </>
);
