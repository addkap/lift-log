import { sanitizeNumber } from '../lib/draft';

/** A big number box that opens the phone's number keypad. */
export default function NumberField(props: {
  value: string;
  onChange: (v: string) => void;
  label: string; // read by screen readers; visible headings are on the page
  decimal?: boolean; // weight allows decimals, reps do not
}) {
  const { value, onChange, label, decimal = false } = props;
  return (
    <input
      className="num"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern={decimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
      autoComplete="off"
      aria-label={label}
      value={value}
      // Select everything on tap so typing replaces the old number.
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(sanitizeNumber(e.target.value, decimal))}
    />
  );
}
