// How each chapter of the homepage story opens: a small gold label and the
// chapter's title, nothing more, so the sections flow into one another.
export function ChapterOpening({ label, title, id, children, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 text-center ${className}`}>
      <p className="m-0 text-[11px] font-medium uppercase tracking-label text-gold-soft">{label}</p>
      {title && (
        <h2 id={id} className="m-0 mt-4 max-w-3xl font-display text-[clamp(36px,4.6vw,64px)] font-normal leading-[1.05] text-ivory">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
