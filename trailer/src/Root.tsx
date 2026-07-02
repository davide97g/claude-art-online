import "./index.css";
import { Composition } from "remotion";
import { Trailer, FPS, trailerDurationInFrames } from "./Trailer";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={trailerDurationInFrames}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
