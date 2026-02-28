import "./FairnessMeter.css";

type FairnessMeterProps = {
  /** 0–1 fairness score for the top pick (or session average). */
  value: number;
  label?: string;
};

export function FairnessMeter({ value, label = "Fairness" }: FairnessMeterProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tier = pct >= 80 ? "high" : pct >= 50 ? "mid" : "low";

  return (
    <div className={`fairness-meter fairness-meter--${tier}`}>
      <div className="fairness-meter__header">
        <span className="fairness-meter__label">{label}</span>
        <span className="fairness-meter__value">{pct}%</span>
      </div>
      <div className="fairness-meter__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="fairness-meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
