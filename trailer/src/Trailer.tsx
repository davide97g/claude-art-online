import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";

// ---------------------------------------------------------------------------
// Trailer timeline — EDIT HERE. Durations in seconds. Reorder / retime freely.
// A `clip` shows footage from public/clips/<src> (null → gradient placeholder so
// the whole trailer previews before every clip is captured). A `card` is a
// full-screen text beat. Consecutive scenes cross-dissolve.
// ---------------------------------------------------------------------------
export const FPS = 30;
const XFADE = 0.5; // seconds of cross-dissolve between scenes

type Scene =
  | { kind: "card"; dur: number; title: string; sub?: string; live?: string }
  | { kind: "partner"; dur: number; tagline?: string }
  | {
      kind: "clip";
      dur: number;
      src: string | null;
      trimBefore?: number; // seconds to skip into the clip
      text?: string;
      pos?: "lower" | "center";
    };

export const SCENES: Scene[] = [
  // studio-style partnership open (logos) — the title is held back for the reveal at the end
  { kind: "partner", dur: 3.6, tagline: "a render partnership" },
  { kind: "clip", dur: 5, src: "open.mp4", text: "Claude Fable now builds 3D worlds in Blender.", pos: "lower" },
  // biome-morph walk: same stride, the world dissolves green → snow → storm around him
  { kind: "clip", dur: 2.6, src: "walk1.mp4", trimBefore: 0.4, text: "MCP is the way.", pos: "lower" },
  { kind: "clip", dur: 2.2, src: "walk2.mp4", trimBefore: 1.5 },
  { kind: "clip", dur: 3.2, src: "walk3.mp4", trimBefore: 1.5, text: "Discover Skills with Blender.", pos: "lower" },
  { kind: "clip", dur: 6.5, src: "dummy.mp4", trimBefore: 3, text: "Combat, coded by Claude.", pos: "lower" },
  { kind: "card", dur: 2.4, title: "Even the game feel — tuned by prompt." },
  { kind: "clip", dur: 8, src: "golem.mp4", trimBefore: 8, text: "Boss AI, from a conversation.", pos: "lower" },
  { kind: "clip", dur: 4.5, src: "orbit.mp4", text: "From code to world.", pos: "lower" },
  { kind: "card", dur: 4.6, title: "CLAUDE ART ONLINE", sub: "Link start.", live: "LIVE TONIGHT" },
];

// Cumulative start frame of each scene (scenes overlap by XFADE for the dissolve).
const starts = (() => {
  const xf = XFADE * FPS;
  let acc = 0;
  return SCENES.map((s) => {
    const from = acc;
    acc += Math.round(s.dur * FPS) - xf;
    return from;
  });
})();

export const trailerDurationInFrames = Math.round(
  starts[starts.length - 1] + SCENES[SCENES.length - 1].dur * FPS,
);

const ease = Easing.inOut(Easing.cubic);

// Full-screen scene wrapper: fades IN over XFADE (dissolving over the scene
// beneath). The last scene also fades OUT to black.
const Scene: React.FC<{ dur: number; isLast: boolean; children: React.ReactNode }> = ({
  dur,
  isLast,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durF = dur * fps;
  const xf = XFADE * fps;
  const opacity = isLast
    ? interpolate(frame, [0, xf, durF - xf, durF], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ease,
      })
    : interpolate(frame, [0, xf], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ease,
      });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const PlaceholderBg: React.FC<{ label?: string }> = ({ label }) => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(135deg,#12202e 0%,#0b0e14 60%,#1a2a1e 100%)",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div style={{ color: "#33445a", font: "600 26px system-ui", letterSpacing: "0.3em" }}>
      {label ? `[ ${label} ]` : "· · ·"}
    </div>
  </AbsoluteFill>
);

const Clip: React.FC<{ src: string | null; trimBefore?: number }> = ({ src, trimBefore }) => {
  const { fps } = useVideoConfig();
  if (!src) return <PlaceholderBg label={"missing clip"} />;
  return (
    <Video
      src={staticFile(`clips/${src}`)}
      trimBefore={trimBefore ? Math.round(trimBefore * fps) : undefined}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

// Lower-third / centered caption that eases in a beat after the clip starts and
// eases out before it ends.
const Caption: React.FC<{ text: string; dur: number; pos?: "lower" | "center" }> = ({
  text,
  dur,
  pos = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = 0.5 * fps;
  const durF = dur * fps;
  const outS = durF - 0.6 * fps;
  const opacity = interpolate(frame, [inS, inS + 0.5 * fps, outS, outS + 0.5 * fps], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const y = interpolate(frame, [inS, inS + 0.6 * fps], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: pos === "lower" ? "flex-end" : "center",
        paddingBottom: pos === "lower" ? 120 : 0,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          color: "#eaf2ff",
          font: "600 44px system-ui",
          letterSpacing: "0.12em",
          textShadow: "0 3px 24px rgba(0,0,0,0.9)",
          textAlign: "center",
          maxWidth: 1500,
          lineHeight: 1.25,
          padding: "0 60px",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ title: string; sub?: string; dur: number; live?: string }> = ({ title, sub, dur, live }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durF = dur * fps;
  const tIn = interpolate(frame, [0.3 * fps, 1.1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const tOut = interpolate(frame, [durF - 0.6 * fps, durF], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const y = interpolate(frame, [0.3 * fps, 1.1 * fps], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const opacity = Math.min(tIn, tOut);
  const subIn = interpolate(frame, [0.9 * fps, 1.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  // short punchy titles get the big uppercase treatment; sentence-length beats shrink + wrap
  const long = title.length > 22;
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(120% 120% at 50% 40%,#0f1622 0%,#05070c 100%)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          color: "#eaf2ff",
          font: long ? "600 42px system-ui" : "600 62px system-ui",
          letterSpacing: long ? "0.06em" : "0.3em",
          textTransform: long ? "none" : "uppercase",
          textAlign: "center",
          textShadow: "0 4px 30px rgba(0,0,0,0.8)",
          maxWidth: 1400,
          lineHeight: 1.25,
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            opacity: Math.min(subIn, tOut),
            marginTop: 22,
            color: "#7fd4ff",
            font: "500 22px system-ui",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
          }}
        >
          {sub}
        </div>
      )}
      {live && (
        <div
          style={{
            opacity: Math.min(
              interpolate(frame, [1.5 * fps, 2.2 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: ease,
              }),
              tOut,
            ),
            marginTop: 30,
            padding: "9px 20px",
            border: "1.5px solid #ff5a4d",
            borderRadius: 6,
            color: "#fff",
            background: "rgba(255,90,77,0.14)",
            font: "700 20px system-ui",
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ff3b3b",
              boxShadow: "0 0 10px #ff3b3b",
            }}
          />
          {live}
        </div>
      )}
    </AbsoluteFill>
  );
};

// Studio-style partnership card: Claude Code × Blender, using the official logo files.
const ClaudeMark: React.FC<{ size: number }> = ({ size }) => (
  <Img src={staticFile("claude-ai-icon.webp")} style={{ height: size, width: "auto" }} />
);

const BlenderMark: React.FC<{ size: number }> = ({ size }) => (
  <Img src={staticFile("Blender_logo_no_text.svg.webp")} style={{ height: size, width: "auto" }} />
);

const Partner: React.FC<{ tagline?: string; dur: number }> = ({ tagline, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durF = dur * fps;
  const tIn = interpolate(frame, [0.3 * fps, 1.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const tOut = interpolate(frame, [durF - 0.6 * fps, durF], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const y = interpolate(frame, [0.3 * fps, 1.2 * fps], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const tagIn = interpolate(frame, [1.0 * fps, 1.7 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const opacity = Math.min(tIn, tOut);
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(120% 120% at 50% 45%,#0f1622 0%,#05070c 100%)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          display: "flex",
          alignItems: "center",
          gap: 46,
          color: "#eaf2ff",
          font: "600 40px system-ui",
          letterSpacing: "0.12em",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <ClaudeMark size={72} />
          <span>Claude&nbsp;Code</span>
        </span>
        <span style={{ color: "#5b6b80", fontWeight: 300, fontSize: 34 }}>×</span>
        <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <BlenderMark size={72} />
          <span>Blender</span>
        </span>
      </div>
      {tagline && (
        <div
          style={{
            opacity: Math.min(tagIn, tOut),
            marginTop: 30,
            color: "#7f8da0",
            font: "500 17px system-ui",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
          }}
        >
          {tagline}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const Trailer: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070c" }}>
      {SCENES.map((s, i) => {
        const durF = Math.round(s.dur * FPS);
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF} name={`${s.kind}-${i}`}>
            <Scene dur={s.dur} isLast={i === SCENES.length - 1}>
              {s.kind === "partner" ? (
                <Partner tagline={s.tagline} dur={s.dur} />
              ) : s.kind === "card" ? (
                <Card title={s.title} sub={s.sub} dur={s.dur} live={s.live} />
              ) : (
                <>
                  <Clip src={s.src} trimBefore={s.trimBefore} />
                  {s.text && <Caption text={s.text} dur={s.dur} pos={s.pos} />}
                </>
              )}
            </Scene>
          </Sequence>
        );
      })}
      <Audio
        src={staticFile("Far Horizon Signal.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, FPS, trailerDurationInFrames - 1.5 * FPS, trailerDurationInFrames],
            [0, 0.85, 0.85, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
    </AbsoluteFill>
  );
};
