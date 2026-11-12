export function TagChips({ tags, selected, onToggle }: { tags: string[]; selected: string[]; onToggle: (tag: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = selected.includes(t);
        return (
          <button key={t} type="button" aria-pressed={on} onClick={() => onToggle(t)} className={`chip ${on ? 'chip-on' : ''}`}>
            {t}
          </button>
        );
      })}
    </div>
  );
}
