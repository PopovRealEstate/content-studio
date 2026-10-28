import React from "react";
import { Composition } from "remotion";
import { LogoSting } from "./scenes/LogoSting";
import { theme } from "./theme";

const FPS = 30;
// VO cut: exit (0.45s) plus a short tail of grade/grain after the exit.
const VO_FRAMES = Math.ceil((theme.vo.exit + 0.8) * FPS);

export const Root: React.FC = () => (
  <>
    <Composition id="LogoSting" component={LogoSting} durationInFrames={150} fps={FPS} width={1920} height={1080} />
    <Composition
      id="LogoStingVO"
      component={LogoSting}
      defaultProps={{ vo: true }}
      durationInFrames={VO_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
