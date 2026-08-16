/**
 * dsh-preset-switch — client half.
 *
 * Renders a small mode-switch button in the `conversation.input.left` seat of
 * the composer tool row — immediately beside the access-mode (permission)
 * control. The menu lists the agent-preset roster from the existing
 * `agentPresets.list` Remote; selecting one runs the `/preset <id>` command
 * through the session command channel, exactly like the shipped /permission
 * picker.
 *
 * This file is a browser module in the dsh client module format: the loader
 * wraps it, and `require` resolves against the scanned dsh.client module
 * table. Only `react` is required; everything else comes from ctx services.
 */
window.__ModuleLoader__.load({
  id: "dsh-preset-switch",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    const NS = "preset.switch";
    const inject = ["slots", "locale", "sessions", "connection"];

    function apply(ctx) {
      const locale = ctx.get("locale");
      if (locale !== undefined) {
        ctx.effect(() => locale.register(NS, "zh", {
          aria: "切换 Agent 模式",
          current: "当前模式：{name}",
          switching: "切换中…",
          failed: "切换失败：{message}",
          empty: "暂无可用模式",
          user: "自定义"
        }), "preset-switch: zh dict");
        ctx.effect(() => locale.register(NS, "en", {
          aria: "Switch agent preset",
          current: "Current mode: {name}",
          switching: "Switching…",
          failed: "Switch failed: {message}",
          empty: "No presets available",
          user: "Custom"
        }), "preset-switch: en dict");
      }
      const t = locale === undefined ? (key, params) => {
        const fallback = {
          aria: "切换 Agent 模式",
          current: "当前模式：{name}",
          switching: "切换中…",
          failed: "切换失败：{message}",
          empty: "暂无可用模式",
          user: "自定义"
        };
        let text = fallback[key] ?? key;
        if (params !== undefined) for (const k of Object.keys(params)) text = text.replaceAll(`{${k}}`, String(params[k]));
        return text;
      } : locale.bind(NS);

      const api = ctx.get("connection")?.api;
      const sessions = ctx.get("sessions");

      ctx.slots.inject("conversation.input.left", () => ctx.slots.register(
        { name: "conversation.input.left", id: "preset-switch", order: -50 },
        (props) => {
          const sessionId = props.sessionId;
          const useSessions = props.useSessions;
          const currentPreset = useSessions((state) => state.byId[sessionId]?.agentPreset);
          const [open, setOpen] = react.useState(false);
          const [roster, setRoster] = react.useState(null);
          const [error, setError] = react.useState(null);
          const [busy, setBusy] = react.useState(false);
          const [current, setCurrent] = react.useState(currentPreset);
          const rootRef = react.useRef(null);
          react.useEffect(() => setCurrent(currentPreset), [currentPreset]);
          react.useEffect(() => {
            if (!open) return;
            const onPointerDown = (ev) => {
              if (rootRef.current !== null && ev.target instanceof Node && rootRef.current.contains(ev.target)) return;
              setOpen(false);
            };
            document.addEventListener("pointerdown", onPointerDown, true);
            return () => document.removeEventListener("pointerdown", onPointerDown, true);
          }, [open]);
          const load = async () => {
            if (api === undefined) {
              setError("connection api unavailable");
              return;
            }
            try {
              const response = await api.agentPresets.list({});
              const value = response?.result?.ok === true ? response.result.value : undefined;
              if (value === undefined) {
                setError("could not load agent presets");
                return;
              }
              setRoster(value.presets);
              setError(null);
            } catch (e) {
              setError(String(e && e.message ? e.message : e));
            }
          };
          const switchTo = async (id) => {
            if (id === current) {
              setOpen(false);
              return;
            }
            if (sessions === undefined) {
              setError("sessions service unavailable");
              return;
            }
            const live = sessions.binding(sessionId)?.session;
            if (live === undefined) {
              setError("session is not materialized yet");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              const result = await live.command(`/preset ${id}`);
              if (!result.ok) {
                setError(String(result.error && result.error.message ? result.error.message : "command failed"));
              } else {
                setCurrent(id);
                setOpen(false);
              }
            } catch (e) {
              setError(String(e && e.message ? e.message : e));
            } finally {
              setBusy(false);
            }
          };
          const toggle = () => {
            if (!open) load();
            setOpen(!open);
          };
          const items = roster === null ? [] : roster;
          const currentName = (() => {
            const entry = items.find((p) => p.id === current);
            return entry ? (entry.trust === "user" ? `${entry.name} · ${t("user")}` : entry.name) : (current ?? "");
          })();
          const label = busy ? t("switching") : (currentName !== "" ? currentName : "");
          return react.createElement("span", { ref: rootRef, style: { position: "relative", display: "inline-flex" } },
            react.createElement("button", {
              type: "button",
              disabled: busy,
              "aria-haspopup": "menu",
              "aria-expanded": open,
              "aria-label": t("aria"),
              title: t("current", { name: label === "" ? current : label }),
              onClick: toggle,
              style: {
                height: 28,
                maxWidth: 180,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "0 8px",
                border: "none",
                borderRadius: 999,
                background: "transparent",
                color: "var(--dsw-alias-label-secondary)",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: "20px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                font: "inherit"
              }
            },
              react.createElement("span", { "aria-hidden": true, style: { fontSize: 14, flex: "none" } }, "⇄"),
              react.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label)
            ),
            open && react.createElement("div", {
              role: "menu",
              style: {
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: 0,
                zIndex: 100,
                minWidth: 220,
                maxWidth: 300,
                maxHeight: 320,
                overflowY: "auto",
                background: "var(--dsw-specific-menu)",
                border: "1px solid var(--dsw-alias-border-l2)",
                borderRadius: 12,
                boxShadow: "var(--dsw-shadow-lv3)",
                padding: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2
              },
              onMouseDown: (e) => e.preventDefault()
            },
              error !== null && react.createElement("div", {
                style: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12, padding: "4px 8px", maxWidth: 280 }
              }, t("failed", { message: error })),
              items.length === 0 && error === null && react.createElement("div", {
                style: { color: "var(--dsw-alias-label-caption)", fontSize: 12, padding: "4px 8px" }
              }, t("empty")),
              items.map((p) => react.createElement("button", {
                key: p.id,
                type: "button",
                role: "menuitem",
                disabled: busy,
                onClick: () => switchTo(p.id),
                title: p.description ?? p.id,
                style: {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: 8,
                  background: p.id === current ? "var(--dsw-alias-interactive-bg-hover)" : "transparent",
                  color: "var(--dsw-alias-label-primary)",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 13,
                  lineHeight: "18px",
                  width: "100%"
                }
              },
                react.createElement("span", { style: { fontWeight: 500 } },
                  p.name + (p.trust === "user" ? ` · ${t("user")}` : "")),
                p.description !== undefined && react.createElement("span", {
                  style: { color: "var(--dsw-alias-label-caption)", fontSize: 12, maxWidth: 260, whiteSpace: "normal" }
                }, p.description)
              ))
            )
          );
        }
      ));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
