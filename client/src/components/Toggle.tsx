import type { ChangeEvent } from "react";
import "./toggle.css";

type ToggleProps = {
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isChecked: boolean;
};

export function Toggle({ handleChange, isChecked }: ToggleProps) {
  return (
    <div className="toggle-container">
      <input
        type="checkbox"
        id="theme-toggle"
        className="toggle"
        onChange={handleChange}
        checked={isChecked}
        aria-label="Toggle dark mode"
      />
      <label htmlFor="theme-toggle">
        <span className="toggle-moon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img" focusable="false">
            <path d="M21 13.06A9 9 0 1 1 10.94 3a7 7 0 1 0 10.06 10.06z" />
          </svg>
        </span>
      </label>
    </div>
  );
}
