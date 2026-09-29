// Geçici logo işareti: kuşbakışı limon dilimi (ağaç noktalarından oluşan dilimler).
// Nihai logo hazır olduğunda bu bileşeni SVG ile değiştirin.
export default function Logo({ size = 30 }: { size?: number }) {
  const dots: [number, number][] = [];
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2 + Math.PI / 8;
    for (const d of [7, 11.5]) dots.push([16 + Math.cos(a) * d, 16 + Math.sin(a) * d]);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#f2c94c" />
      <circle cx="16" cy="16" r="13" fill="#fff6d6" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <line key={i} x1="16" y1="16" x2={16 + Math.cos(a) * 13} y2={16 + Math.sin(a) * 13} stroke="#f2c94c" strokeWidth="1.2" />
        );
      })}
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 2.2 : 1.5} fill={i === 5 ? "#1f3864" : "#2f6b3f"} />
      ))}
    </svg>
  );
}
