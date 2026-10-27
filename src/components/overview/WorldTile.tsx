/**
 * Preview of the World page (project D). A small pixel window with an ember sky.
 * It is meant to look out of place next to the calm violet UI. Not a link yet.
 */
export default function WorldTile() {
  // 32 x 20 pixel grid, drawn with rects. crispEdges keeps every pixel sharp.
  const sky = ['#7a3b1e', '#a8501f', '#d37a2c', '#f0a24a', '#f8c070'];
  const hills: Array<[number, number, number]> = [
    // [x, height, width] columns of back hills
    [0, 5, 6], [6, 7, 5], [11, 6, 6], [17, 8, 5], [22, 6, 6], [28, 7, 4],
  ];
  const front: Array<[number, number, number]> = [
    [0, 3, 8], [8, 4, 6], [14, 3, 7], [21, 4, 6], [27, 3, 5],
  ];
  return (
    <div className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-pixel text-[16px] font-semibold" style={{ color: 'var(--reward-text)' }}>World</h3>
        <span className="font-pixel ml-auto rounded-[4px] px-2 py-0.5 text-[12px]" style={{ background: 'var(--reward)', color: 'var(--on-reward)' }}>soon</span>
      </div>
      <svg
        viewBox="0 0 32 20"
        className="h-auto w-full max-w-[22rem] rounded-[6px]"
        style={{ imageRendering: 'pixelated', border: '3px solid var(--reward)' }}
        shapeRendering="crispEdges"
        role="img"
        aria-label="A small pixel landscape at sunset. The World page is coming later."
      >
        {sky.map((c, i) => (
          <rect key={c} x={0} y={i * 4} width={32} height={4} fill={c} />
        ))}
        <rect x={21} y={5} width={4} height={4} fill="#fff1c9" />
        <rect x={20} y={6} width={6} height={2} fill="#fff1c9" />
        {hills.map(([x, h, w]) => (
          <rect key={`b${x}`} x={x} y={20 - h - 3} width={w} height={h + 3} fill="#5b2a1a" />
        ))}
        {front.map(([x, h, w]) => (
          <rect key={`f${x}`} x={x} y={20 - h} width={w} height={h} fill="#2c140d" />
        ))}
        <rect x={5} y={13} width={1} height={3} fill="#2c140d" />
        <rect x={4} y={12} width={3} height={2} fill="#2c140d" />
      </svg>
      <p className="font-pixel mt-3 text-[14px]" style={{ color: 'var(--reward-text)' }}>A place that grows as you log.</p>
    </div>
  );
}
