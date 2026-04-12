import { useState, useEffect } from "react";
import type { ThemeRegistry, AvailableTheme, ActiveBackground } from "../../theme-registry.js";
import type { ThemeBackgroundEntry } from "@ghost/plugin-contracts";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppearanceSettingsPanelProps {
  themeRegistry: ThemeRegistry;
  onChanged: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  padding: 8,
  background: "var(--ghost-background)",
  color: "var(--ghost-foreground)",
};

const sectionStyle: React.CSSProperties = { marginBottom: 16 };

const headingStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 14,
  color: "var(--ghost-foreground)",
};

const themeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid var(--ghost-border)",
  marginBottom: 4,
  cursor: "pointer",
  background: "var(--ghost-surface)",
};

const themeRowActiveStyle: React.CSSProperties = {
  ...themeRowStyle,
  border: "2px solid var(--ghost-primary)",
  background: "var(--ghost-accent)",
};

const themeNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ghost-foreground)",
};

const themeAuthorStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ghost-muted-foreground)",
  marginLeft: 6,
};

const modeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 10,
  background: "var(--ghost-surface-elevated)",
  color: "var(--ghost-muted-foreground)",
  border: "1px solid var(--ghost-border)",
};

const bgGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const bgThumbStyle: React.CSSProperties = {
  width: 80,
  height: 50,
  objectFit: "cover",
  borderRadius: 4,
  border: "1px solid var(--ghost-border)",
  cursor: "pointer",
};

const bgThumbActiveStyle: React.CSSProperties = {
  ...bgThumbStyle,
  border: "2px solid var(--ghost-primary)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 4,
  background: "var(--ghost-input)",
  border: "1px solid var(--ghost-border)",
  color: "var(--ghost-foreground)",
  fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  padding: 4,
  background: "var(--ghost-input)",
  border: "1px solid var(--ghost-border)",
  color: "var(--ghost-foreground)",
  fontSize: 12,
  borderRadius: 4,
};

const btnStyle: React.CSSProperties = {
  background: "var(--ghost-surface-elevated)",
  border: "1px solid var(--ghost-border)",
  borderRadius: 4,
  color: "var(--ghost-foreground)",
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 11,
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: "var(--ghost-primary)",
  color: "var(--ghost-primary-foreground)",
};

const emptyTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--ghost-muted-foreground)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppearanceSettingsPanel(props: AppearanceSettingsPanelProps) {
  const { themeRegistry, onChanged } = props;
  const [customUrl, setCustomUrl] = useState("");
  const [customMode, setCustomMode] = useState<"cover" | "contain" | "tile">("cover");

  // Load remaining theme plugins on first mount to populate the full gallery.
  useEffect(() => {
    let cancelled = false;
    themeRegistry.loadAllThemes().then(() => { if (!cancelled) onChanged(); });
    return () => { cancelled = true; };
  }, [themeRegistry]); // eslint-disable-line react-hooks/exhaustive-deps

  const themes = themeRegistry.getAvailableThemes();
  const activeThemeId = themeRegistry.getActiveThemeId();
  const backgrounds = themeRegistry.getAvailableBackgrounds();
  const activeBackground = themeRegistry.getActiveBackground();

  const handleThemeSelect = (themeId: string) => {
    themeRegistry.setTheme(themeId);
    onChanged();
  };

  const handleBackgroundSelect = (index: number) => {
    themeRegistry.setBackground(index);
    onChanged();
  };

  const handleApplyCustom = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) {
      return;
    }
    themeRegistry.setCustomBackground(trimmed, customMode);
    setCustomUrl("");
    onChanged();
  };

  const handleClearCustom = () => {
    themeRegistry.clearCustomBackground();
    onChanged();
  };

  return (
    <section aria-label="Appearance settings" style={panelStyle}>
      <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--ghost-foreground)" }}>
        Appearance
      </h2>

      <ThemePickerSection
        themes={themes}
        activeThemeId={activeThemeId}
        onSelect={handleThemeSelect}
      />

      <BackgroundGallerySection
        backgrounds={backgrounds}
        activeBackground={activeBackground}
        customUrl={customUrl}
        customMode={customMode}
        onBackgroundSelect={handleBackgroundSelect}
        onCustomUrlChange={setCustomUrl}
        onCustomModeChange={setCustomMode}
        onApplyCustom={handleApplyCustom}
        onClearCustom={handleClearCustom}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Theme picker sub-component
// ---------------------------------------------------------------------------

function ThemePickerSection(props: {
  themes: AvailableTheme[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
}) {
  return (
    <div style={sectionStyle}>
      <h3 style={headingStyle}>Theme</h3>
      {props.themes.length === 0 ? (
        <p style={emptyTextStyle}>No themes available.</p>
      ) : (
        props.themes.map((theme) => {
          const isActive = theme.id === props.activeThemeId;
          return (
            <div
              key={theme.id}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              style={isActive ? themeRowActiveStyle : themeRowStyle}
              onClick={() => props.onSelect(theme.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  props.onSelect(theme.id);
                }
              }}
            >
              <span>
                <span style={themeNameStyle}>{theme.name}</span>
                {theme.author ? (
                  <span style={themeAuthorStyle}>by {theme.author}</span>
                ) : null}
              </span>
              <span style={modeBadgeStyle}>{theme.mode}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Background gallery sub-component
// ---------------------------------------------------------------------------

function BackgroundGallerySection(props: {
  backgrounds: ThemeBackgroundEntry[];
  activeBackground: ActiveBackground | null;
  customUrl: string;
  customMode: "cover" | "contain" | "tile";
  onBackgroundSelect: (index: number) => void;
  onCustomUrlChange: (value: string) => void;
  onCustomModeChange: (mode: "cover" | "contain" | "tile") => void;
  onApplyCustom: () => void;
  onClearCustom: () => void;
}) {
  const {
    backgrounds, activeBackground, customUrl, customMode,
    onBackgroundSelect, onCustomUrlChange, onCustomModeChange,
    onApplyCustom, onClearCustom,
  } = props;

  const isCustomActive = activeBackground?.source === "custom";

  return (
    <div style={sectionStyle}>
      <h3 style={headingStyle}>Background</h3>
      {backgrounds.length === 0 ? (
        <p style={emptyTextStyle}>No backgrounds available for this theme.</p>
      ) : (
        <div style={bgGridStyle}>
          {backgrounds.map((bg, index) => {
            const isActive =
              activeBackground?.source === "theme" &&
              activeBackground.index === index;
            return (
              <img
                key={`${bg.url}-${index}`}
                src={bg.url}
                alt={`Background ${index + 1}`}
                style={isActive ? bgThumbActiveStyle : bgThumbStyle}
                onClick={() => onBackgroundSelect(index)}
              />
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 12, color: "var(--ghost-muted-foreground)", display: "block", marginBottom: 4 }}>
          Custom background URL
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            style={inputStyle}
            value={customUrl}
            onChange={(event) => onCustomUrlChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onApplyCustom();
              }
            }}
            placeholder="https://example.com/image.jpg"
          />
          <select
            style={selectStyle}
            value={customMode}
            onChange={(event) => {
              onCustomModeChange(event.currentTarget.value as "cover" | "contain" | "tile");
            }}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="tile">Tile</option>
          </select>
          <button
            style={primaryBtnStyle}
            onClick={onApplyCustom}
            type="button"
          >
            Apply
          </button>
        </div>
        {isCustomActive ? (
          <button
            style={{ ...btnStyle, marginTop: 6 }}
            onClick={onClearCustom}
            type="button"
          >
            Clear custom background
          </button>
        ) : null}
      </div>
    </div>
  );
}
