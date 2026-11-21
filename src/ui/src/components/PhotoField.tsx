// Optional photo for a citizen report. The browser shrinks it (max 1600 px, JPEG) before sending – this also drops
// EXIF metadata (GPS position of the phone, device). The photo goes only to the moderators (API: HANDOFF A #8).
import { useId, useState } from 'react';

const MAX_SIDE = 1600;

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('To nie jest zdjęcie albo plik jest uszkodzony.'));
      i.src = url;
    });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoField({ value, onChange, required = false, hint, error, inputId }: {
  value: string | null; onChange: (dataUri: string | null) => void; required?: boolean; hint?: string; error?: string; inputId?: string;
}) {
  const auto = useId();
  const id = inputId ?? auto;
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    setErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Wybierz zdjęcie (JPG, PNG albo HEIC z telefonu).'); return; }
    setBusy(true);
    try {
      const d = await shrink(f);
      if (d.length > 1_900_000) { setErr('Zdjęcie jest za duże nawet po zmniejszeniu. Spróbuj innego.'); return; }
      onChange(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="field photo-field">
      <label htmlFor={`${id}-f`}>{required ? <>Zdjęcie AED<span className="req" aria-hidden="true"> *</span><span className="visually-hidden"> (wymagane)</span></> : 'Zdjęcie AED (nieobowiązkowe)'}</label>
      <p id={`${id}-h`} className="hint">{hint ?? 'Pomoże sprawdzić zgłoszenie. Zrób zdjęcie urządzenia lub szafki tak, żeby nie było widać ludzi. Zobaczy je tylko moderator.'}</p>
      {value ? (
        <div className="photo-field__preview">
          <img src={value} alt="Podgląd wybranego zdjęcia AED" />
          <button type="button" className="btn btn--secondary" onClick={() => onChange(null)}>Usuń zdjęcie</button>
        </div>
      ) : (
        <input id={`${id}-f`} type="file" accept="image/*" capture="environment" aria-describedby={`${id}-h${err || error ? ` ${id}-e` : ''}`}
          aria-invalid={!!(err || error)} required={required} onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
      )}
      {busy && <p className="hint" role="status">Przygotowuję zdjęcie…</p>}
      {(err || error) && <p id={`${id}-e`} className="field-error">{err || error}</p>}
    </div>
  );
}
