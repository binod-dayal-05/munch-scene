import { useEffect, useRef, useState } from "react";
import {
  DIETARY_RESTRICTION_OPTIONS,
  VIBE_OPTIONS,
  type DietaryRestriction,
  type UserPreferences,
  type VibePreference,
} from "@munchscene/shared";

type PreferenceEditorProps = {
  disabled?: boolean;
  preferences: UserPreferences;
  onChange: (next: UserPreferences) => void;
};

const cuisinePlaceholder = "Italian, sushi, tapas";

const priceLabels: Record<UserPreferences["budgetMax"], string> = {
  0: "Free if possible",
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};

export function PreferenceEditor({
  disabled,
  preferences,
  onChange,
}: PreferenceEditorProps) {
  const isEditingCuisine = useRef(false);
  const [cuisineInput, setCuisineInput] = useState(
    preferences.cuisinePreferences.join(", ")
  );

  useEffect(() => {
    if (isEditingCuisine.current) {
      return;
    }
    setCuisineInput(preferences.cuisinePreferences.join(", "));
  }, [preferences.cuisinePreferences]);

  const updateDietary = (restriction: DietaryRestriction) => {
    const nextSet = new Set(preferences.dietaryRestrictions);

    if (nextSet.has(restriction)) {
      nextSet.delete(restriction);
    } else {
      nextSet.add(restriction);
    }

    onChange({
      ...preferences,
      dietaryRestrictions: Array.from(nextSet),
    });
  };

  return (
    <div>
      <div className="pref-grid">
        <div className="ms-field">
          <label className="ms-field__label" htmlFor="pref-cuisine">
            Cuisines
          </label>
          <input
            id="pref-cuisine"
            disabled={disabled}
            type="text"
            value={cuisineInput}
            placeholder={cuisinePlaceholder}
            onFocus={() => {
              isEditingCuisine.current = true;
            }}
            onBlur={() => {
              isEditingCuisine.current = false;
              setCuisineInput(preferences.cuisinePreferences.join(", "));
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setCuisineInput(nextValue);
              onChange({
                ...preferences,
                cuisinePreferences: nextValue
                  .split(/[,\n]/)
                  .map((value) => value.trim())
                  .filter(Boolean),
              });
            }}
          />
        </div>

        <div className="ms-field">
          <label className="ms-field__label" htmlFor="pref-vibe">
            Vibe
          </label>
          <select
            id="pref-vibe"
            disabled={disabled}
            value={preferences.vibePreference}
            onChange={(event) =>
              onChange({
                ...preferences,
                vibePreference: event.target.value as VibePreference,
              })
            }
          >
            {VIBE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="ms-field">
          <label className="ms-field__label" htmlFor="pref-budget">
            Budget ceiling
          </label>
          <select
            id="pref-budget"
            disabled={disabled}
            value={preferences.budgetMax}
            onChange={(event) =>
              onChange({
                ...preferences,
                budgetMax: Number(
                  event.target.value
                ) as UserPreferences["budgetMax"],
              })
            }
          >
            {Object.entries(priceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="ms-field">
          <label className="ms-field__label" htmlFor="pref-distance">
            Max distance (m)
          </label>
          <input
            id="pref-distance"
            disabled={disabled}
            type="number"
            min={250}
            step={250}
            value={preferences.maxDistanceMeters}
            onChange={(event) =>
              onChange({
                ...preferences,
                maxDistanceMeters: Math.max(
                  250,
                  Number(event.target.value) || 250
                ),
              })
            }
          />
        </div>
      </div>

      <div>
        <span className="pref-section-label">Dietary restrictions</span>
        <div className="pref-pills">
          {DIETARY_RESTRICTION_OPTIONS.map((restriction) => {
            const active = preferences.dietaryRestrictions.includes(restriction);

            return (
              <button
                key={restriction}
                type="button"
                disabled={disabled}
                className={`pref-pill${active ? " pref-pill--on" : ""}`}
                onClick={() => updateDietary(restriction)}
              >
                {restriction.replace("_", " ")}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
