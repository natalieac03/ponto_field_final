import { Svg, Rect, Line, Path, Text as SvgText, Circle, G } from "@react-pdf/renderer";
import { C } from "./theme";

/* ── Barras de saldo por semana (valores com sinal) ── */
export interface Bar { label: string; value: number }

export function BarChart({ data, width, height }: { data: Bar[]; width: number; height: number }) {
  const labelStrip = 13;   // faixa inferior reservada aos rótulos de semana
  const valHeadroom = 11;  // topo reservado aos rótulos de valor
  const plotTop = valHeadroom;
  const plotBottom = height - labelStrip;
  const plotH = plotBottom - plotTop;
  const maxV = Math.max(0, ...data.map((d) => d.value));
  const minV = Math.min(0, ...data.map((d) => d.value));
  const range = maxV - minV || 60;
  const zeroY = plotTop + (maxV / range) * plotH;

  const n = Math.max(data.length, 1);
  const slot = width / n;
  const barW = Math.min(26, slot * 0.5);

  const fmt = (m: number) => {
    const a = Math.abs(m);
    return `${m < 0 ? "−" : "+"}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
  };

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={C.border} strokeWidth={1} />
      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        const h = (Math.abs(d.value) / range) * plotH;
        const y = d.value >= 0 ? zeroY - h : zeroY;
        const color = d.value >= 0 ? C.blue : C.neg;
        return (
          <G key={i}>
            <Rect x={cx - barW / 2} y={y} width={barW} height={Math.max(h, 0.5)} fill={color} rx={2} />
            <SvgText
              x={cx} y={d.value >= 0 ? Math.max(y - 3, 7) : Math.min(y + h + 8, plotBottom - 2)}
              style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold" }} fill={color} textAnchor="middle"
            >
              {fmt(d.value)}
            </SvgText>
            <SvgText
              x={cx} y={height - 2}
              style={{ fontSize: 6.5, fontFamily: "Helvetica" }} fill={C.muted} textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/* ── Donut de distribuição (tipos de dia) ── */
export interface Slice { label: string; value: number; color: string }

function arc(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x1, y1] = p(rO, a0);
  const [x2, y2] = p(rO, a1);
  const [x3, y3] = p(rI, a1);
  const [x4, y4] = p(rI, a0);
  return `M ${x1} ${y1} A ${rO} ${rO} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rI} ${rI} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function Donut({ slices, size, centerTop, centerBottom }: {
  slices: Slice[]; size: number; centerTop?: string; centerBottom?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const cx = size / 2, cy = size / 2;
  const rO = size / 2 - 2, rI = rO * 0.58;
  let angle = -Math.PI / 2;

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => {
        const frac = s.value / total;
        const a0 = angle;
        let a1 = angle + frac * Math.PI * 2;
        angle = a1;
        if (s.value === 0) return null;
        if (frac >= 0.9999) {
          // círculo cheio (evita arco degenerado)
          return (
            <Circle key={i} cx={cx} cy={cy} r={(rO + rI) / 2} stroke={s.color} strokeWidth={rO - rI} fill="none" />
          );
        }
        a1 -= 0.0001;
        return <Path key={i} d={arc(cx, cy, rO, rI, a0, a1)} fill={s.color} />;
      })}
      {centerTop && (
        <SvgText x={cx} y={cy - 1} style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }} fill={C.dark} textAnchor="middle">
          {centerTop}
        </SvgText>
      )}
      {centerBottom && (
        <SvgText x={cx} y={cy + 9} style={{ fontSize: 6.5 }} fill={C.muted} textAnchor="middle">
          {centerBottom}
        </SvgText>
      )}
    </Svg>
  );
}
