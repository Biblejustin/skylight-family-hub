export function PaginationDots({ total, current, threshold = 10 }: { total: number; current: number; threshold?: number }) {
  if (total <= 1) return null;

  if (total <= threshold) {
    return (
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === current ? 'bg-white/80' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <span className="text-white/30 tabular-nums" style={{ fontSize: '0.6em' }}>
      {current + 1} / {total}
    </span>
  );
}
