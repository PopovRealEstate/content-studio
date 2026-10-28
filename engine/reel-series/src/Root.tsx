import React from "react";
import { Composition } from "remotion";
import { REELS } from "./data";
import { ReelData } from "./engine";
import { Luxury } from "./styles/Luxury";
import { Motorsport } from "./styles/Motorsport";
import { Notes } from "./styles/Notes";

const STYLE = { luxury: Luxury, motorsport: Motorsport, notes: Notes } as const;
const NAME = { luxury: "Luxury", motorsport: "Motorsport", notes: "Notes" } as const;

export const Root: React.FC = () => (
  <>
    {(REELS as unknown as ReelData[]).map((d) => {
      const style = d.style as keyof typeof STYLE;
      return (
        <Composition
          key={d.id} id={`R${String(d.id).padStart(2, "0")}${NAME[style]}`} component={STYLE[style] as React.FC<{ data: ReelData }>}
          defaultProps={{ data: d }} durationInFrames={Math.round(d.total * 30)} fps={30} width={1080} height={1920}
        />
      );
    })}
  </>
);
