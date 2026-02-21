import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

// ✅ Always show this on refresh (Hello only)
const starter = `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello Java!");
  }
}
`;

function nowLabel() {
  return new Date().toLocaleString();
}

export default function App() {
  const [code, setCode] = useState(starter);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [lastOk, setLastOk] = useState(true);

  // ✅ Theme
  const [theme, setTheme] = useState(() => localStorage.getItem("uiTheme") || "dark");
  const isDark = theme === "dark";
  const monacoTheme = isDark ? "vs-dark" : "vs";

  // ✅ Echo input near prompts
  const [echoInput, setEchoInput] = useState(() => localStorage.getItem("echoInput") !== "0");

  // ✅ History (stored in localStorage)
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("runHistory") || "[]");
    } catch {
      return [];
    }
  });

  // ✅ History Drawer open/close
  const [historyOpen, setHistoryOpen] = useState(false);

  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_URL || "http://localhost:5000/run",
    []
  );

  // ✅ Always reset editor on every page refresh/load
  useEffect(() => {
    // If old versions stored code in localStorage, remove them (safe)
    localStorage.removeItem("savedCode");
    localStorage.removeItem("code");
    localStorage.removeItem("editorCode");
    localStorage.removeItem("lastCode");

    setCode(starter);
    setInput("");
    setOutput("");
  }, []);

  useEffect(() => localStorage.setItem("uiTheme", theme), [theme]);
  useEffect(() => localStorage.setItem("echoInput", echoInput ? "1" : "0"), [echoInput]);
  useEffect(() => localStorage.setItem("runHistory", JSON.stringify(history)), [history]);

  // ESC to close drawer
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ✅ Pretty output: Enter a: 10
  const formatOutputWithInput = (rawOut, rawInput) => {
    const out = rawOut ?? "";
    const inp = (rawInput ?? "").trim();
    if (!echoInput || !inp) return out;

    const inputLines = inp
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (inputLines.length === 0) return out;

    // Only modify if prompt-looking lines exist
    if (!/Enter\s+/i.test(out)) return out;

    let idx = 0;
    return out
      .split("\n")
      .map((line) => {
        const m = line.match(/^\s*(Enter\s+.*?:)\s*$/i);
        if (m && idx < inputLines.length) {
          const prompt = m[1];
          const val = inputLines[idx++];
          return `${prompt} ${val}`;
        }
        return line;
      })
      .join("\n");
  };

  const saveToHistory = ({ codeSnap, inputSnap, outSnap, ok }) => {
    const item = {
      id: crypto.randomUUID(),
      time: nowLabel(),
      ok,
      code: codeSnap,
      input: inputSnap,
      output: outSnap
    };
    setHistory((prev) => [item, ...prev].slice(0, 30)); // keep last 30 runs
  };

  const loadHistoryItem = (item) => {
    setCode(item.code);
    setInput(item.input);
    setOutput(item.output);
    setLastOk(item.ok);
  };

  const deleteHistoryItem = (id) => setHistory((prev) => prev.filter((x) => x.id !== id));
  const clearHistory = () => setHistory([]);

  const run = async () => {
    setRunning(true);
    setLastOk(true);
    setOutput("Running...");

    const codeSnap = code;
    const inputSnap = input;

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeSnap, input: inputSnap })
      });

      const data = await res.json();
      const rawOut = data?.output ?? "";
      const prettyOut = formatOutputWithInput(rawOut, inputSnap);

      const isErr = /error:|Exception|^\s*at\s+/im.test(rawOut);
      const ok = !isErr;

      setLastOk(ok);
      setOutput(prettyOut || "(no output)");

      saveToHistory({ codeSnap, inputSnap, outSnap: prettyOut || "(no output)", ok });
    } catch (e) {
      const msg = "Client Error: " + (e?.message || e);
      setLastOk(false);
      setOutput(msg);
      saveToHistory({ codeSnap, inputSnap, outSnap: msg, ok: false });
    } finally {
      setRunning(false);
    }
  };

  const clearAll = () => {
    setOutput("");
    setInput("");
  };

  return (
    <div style={styles.page(isDark)}>
      {/* Top Bar */}
      <header style={styles.topbar(isDark)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={styles.brandRow}>
            <span style={styles.logo}>☕</span>
            <span style={styles.brand}>PKP Compiler for Java Beginners</span>
            <span style={styles.badge(isDark)}>PRO</span>
          </div>
          <div style={styles.subtext(isDark)}>
            Multi Concept// • OOP • DS • Scanner input • Instant output
          </div>
        </div>

        <div style={styles.topRight}>
          {/* Theme Switch */}
          <div style={styles.switchWrap(isDark)} title="Toggle theme">
            <button
              onClick={() => setTheme("light")}
              style={styles.switchBtn(isDark, theme === "light")}
              disabled={running}
            >
              ☀️ Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              style={styles.switchBtn(isDark, theme === "dark")}
              disabled={running}
            >
              🌙 Dark
            </button>
          </div>

          <div style={styles.status(isDark)}>
            <span
              style={{
                ...styles.dot,
                background: running ? "#fbbf24" : "#22c55e"
              }}
            />
            <span style={{ opacity: 0.9 }}>{running ? "Running..." : "Ready"}</span>
          </div>

          {/* History button */}
          <button
            onClick={() => setHistoryOpen(true)}
            style={{ ...styles.btn(isDark), ...styles.btnGhost(isDark) }}
            disabled={running}
          >
            History 📜 ({history.length})
          </button>

          <button
            onClick={clearAll}
            style={{ ...styles.btn(isDark), ...styles.btnGhost(isDark) }}
            disabled={running}
          >
            Clear
          </button>

          <button
            onClick={run}
            style={{ ...styles.btn(isDark), ...styles.btnPrimary(isDark) }}
            disabled={running}
          >
            {running ? "Running..." : "Run ▶"}
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={styles.main}>
        {/* Editor */}
        <section style={styles.card(isDark)}>
          <div style={styles.cardHeader(isDark)}>
            <div style={styles.cardTitle}>Editor</div>
            <div style={styles.hint(isDark)}>Theme: {theme}</div>
          </div>

          <div style={styles.editorWrap}>
            <Editor
              height="100%"
              defaultLanguage="java"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              theme={monacoTheme}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2
              }}
            />
          </div>
        </section>

        {/* Right Side */}
        <section style={styles.side}>
          {/* Input */}
          <div style={styles.cardSmall(isDark)}>
            <div style={styles.cardHeaderSmall(isDark)}>
              <div style={styles.cardTitle}>Input : For User</div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={styles.hint(isDark)}>For Scanner / stdin</div>

                <label style={styles.echoToggle(isDark)} title="Show input value next to prompts">
                  <input
                    type="checkbox"
                    checked={echoInput}
                    onChange={(e) => setEchoInput(e.target.checked)}
                    disabled={running}
                    style={{ accentColor: "#8b5cf6" }}
                  />
                  <span style={{ fontSize: 12, opacity: 0.9 }}>Echo input</span>
                </label>
              </div>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Example:\n10\n20\n`}
              style={styles.textarea(isDark)}
            />
          </div>

          {/* Output */}
          <div style={{ ...styles.cardSmall(isDark), flex: 1 }}>
            <div style={styles.cardHeaderSmall(isDark)}>
              <div style={styles.cardTitle}>Output</div>
              <div style={styles.hint(isDark)}>{lastOk ? "Success" : "Error"}</div>
            </div>

            <pre
              style={{
                ...styles.output(isDark),
                color: lastOk
                  ? isDark
                    ? "#86efac"
                    : "#166534"
                  : isDark
                  ? "#fca5a5"
                  : "#991b1b"
              }}
            >
              {output || "Run your code to see output..."}
            </pre>
          </div>
        </section>
      </main>

      {/* History Drawer */}
      {historyOpen && (
        <>
          <div style={styles.drawerBackdrop} onClick={() => setHistoryOpen(false)} />
          <aside style={styles.drawer(isDark)}>
            <div style={styles.drawerHeader(isDark)}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>History</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={clearHistory}
                  disabled={running || history.length === 0}
                  style={{ ...styles.smallBtn(isDark), opacity: history.length ? 1 : 0.6 }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setHistoryOpen(false)}
                  style={styles.closeBtn(isDark)}
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={styles.drawerList(isDark)}>
              {history.length === 0 ? (
                <div style={styles.historyEmpty(isDark)}>
                  No runs yet. Click <b>Run ▶</b> to save history.
                </div>
              ) : (
                history.map((h) => (
                  <div key={h.id} style={styles.historyItem(isDark)}>
                    <button
                      onClick={() => {
                        loadHistoryItem(h);
                        setHistoryOpen(false);
                      }}
                      style={styles.historyLoadBtn(isDark)}
                      title="Load this run"
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontWeight: 800 }}>{h.ok ? "✅ Success" : "❌ Error"}</span>
                        <span style={{ fontSize: 11, opacity: 0.75 }}>{h.time}</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                        Output preview: {String(h.output || "").split("\n")[0].slice(0, 70)}
                        {String(h.output || "").length > 70 ? "..." : ""}
                      </div>
                    </button>

                    <button
                      onClick={() => deleteHistoryItem(h.id)}
                      style={styles.historyDelBtn(isDark)}
                      title="Delete"
                      disabled={running}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </>
      )}

      <footer style={styles.footer(isDark)}>
        <span style={{ opacity: 0.85 }}>
          Backend: {apiUrl.replace("/run", "")} • History saved locally
        </span>
      </footer>
    </div>
  );
}

const styles = {
  page: (dark) => ({
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: dark
      ? "radial-gradient(1200px 600px at 20% 10%, rgba(59,130,246,0.28), transparent 60%)," +
        "radial-gradient(900px 500px at 90% 20%, rgba(168,85,247,0.25), transparent 55%)," +
        "radial-gradient(900px 600px at 60% 100%, rgba(34,197,94,0.18), transparent 55%)," +
        "linear-gradient(180deg, #05070f, #070a12)"
      : "radial-gradient(1200px 600px at 20% 10%, rgba(59,130,246,0.20), transparent 60%)," +
        "radial-gradient(900px 500px at 90% 20%, rgba(168,85,247,0.18), transparent 55%)," +
        "radial-gradient(900px 600px at 60% 100%, rgba(34,197,94,0.14), transparent 55%)," +
        "linear-gradient(180deg, #f6f7fb, #eef2ff)",
    color: dark ? "#e5e7eb" : "#0f172a",
    display: "flex",
    flexDirection: "column"
  }),

  topbar: (dark) => ({
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)"}`,
    backdropFilter: "blur(10px)"
  }),

  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontSize: 22 },
  brand: { fontSize: 18, fontWeight: 800, letterSpacing: 0.2 },

  badge: (dark) => ({
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    border: `1px solid ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
  }),

  subtext: (dark) => ({ fontSize: 12.5, opacity: dark ? 0.8 : 0.7 }),
  topRight: { display: "flex", alignItems: "center", gap: 10 },

  switchWrap: (dark) => ({
    display: "flex",
    borderRadius: 999,
    border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    overflow: "hidden"
  }),

  switchBtn: (dark, active) => ({
    padding: "8px 10px",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    background: active
      ? dark
        ? "linear-gradient(90deg, rgba(59,130,246,0.85), rgba(168,85,247,0.85))"
        : "linear-gradient(90deg, rgba(59,130,246,0.20), rgba(168,85,247,0.18))"
      : "transparent",
    color: dark ? "#e5e7eb" : "#0f172a",
    opacity: active ? 1 : 0.8
  }),

  status: (dark) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
  }),

  dot: { width: 8, height: 8, borderRadius: 999 },

  btn: (dark) => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    color: dark ? "#e5e7eb" : "#0f172a",
    cursor: "pointer",
    fontWeight: 700
  }),

  btnGhost: () => ({ opacity: 0.9 }),

  btnPrimary: (dark) => ({
    background: dark
      ? "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(168,85,247,0.95))"
      : "linear-gradient(90deg, rgba(59,130,246,0.35), rgba(168,85,247,0.25))"
  }),

  main: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1.7fr 0.95fr",
    gap: 14,
    padding: 14,
    minHeight: 0
  },

  card: (dark) => ({
    borderRadius: 18,
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.70)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0
  }),

  cardHeader: (dark) => ({
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`
  }),

  editorWrap: { flex: 1, minHeight: 0 },

  side: { display: "flex", flexDirection: "column", gap: 14, minHeight: 0 },

  cardSmall: (dark) => ({
    borderRadius: 18,
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.70)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 10px 35px rgba(0,0,0,0.20)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0
  }),

  cardHeaderSmall: (dark) => ({
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`
  }),

  cardTitle: { fontWeight: 900, letterSpacing: 0.2 },
  hint: (dark) => ({ fontSize: 12, opacity: dark ? 0.75 : 0.7 }),

  textarea: (dark) => ({
    flex: 1,
    minHeight: 130,
    resize: "none",
    padding: 12,
    border: "none",
    outline: "none",
    background: dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.85)",
    color: dark ? "#e5e7eb" : "#0f172a",
    fontSize: 13.5,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18
  }),

  output: (dark) => ({
    flex: 1,
    minHeight: 0,
    margin: 0,
    padding: 12,
    overflow: "auto",
    background: dark ? "rgba(0,0,0,0.42)" : "rgba(255,255,255,0.90)",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    fontSize: 13.5,
    whiteSpace: "pre-wrap"
  }),

  footer: (dark) => ({
    padding: "10px 16px",
    borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)"}`,
    fontSize: 12,
    display: "flex",
    justifyContent: "center",
    color: dark ? "#cbd5e1" : "#334155"
  }),

  echoToggle: (dark) => ({
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
  }),

  smallBtn: (dark) => ({
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    color: dark ? "#e5e7eb" : "#0f172a",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12
  }),

  historyEmpty: (dark) => ({
    fontSize: 12.5,
    opacity: dark ? 0.85 : 0.8,
    padding: 8
  }),

  historyItem: (dark) => ({
    display: "flex",
    gap: 8,
    alignItems: "stretch",
    marginBottom: 10
  }),

  historyLoadBtn: (dark) => ({
    flex: 1,
    textAlign: "left",
    padding: 10,
    borderRadius: 14,
    border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
    color: dark ? "#e5e7eb" : "#0f172a",
    cursor: "pointer"
  }),

  historyDelBtn: (dark) => ({
    width: 44,
    borderRadius: 14,
    border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
    color: dark ? "#e5e7eb" : "#0f172a",
    cursor: "pointer",
    fontSize: 16
  }),

  // Drawer styles
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 9998
  },

  drawer: (dark) => ({
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: "420px",
    maxWidth: "92vw",
    zIndex: 9999,
    borderLeft: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(10,12,20,0.92)" : "rgba(245,247,255,0.92)",
    backdropFilter: "blur(16px)",
    boxShadow: "-10px 0 35px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column"
  }),

  drawerHeader: (dark) => ({
    padding: "14px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`
  }),

  drawerList: (dark) => ({
    flex: 1,
    overflow: "auto",
    padding: 12
  }),

  closeBtn: (dark) => ({
    width: 40,
    height: 36,
    borderRadius: 12,
    border: `1px solid ${dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    color: dark ? "#e5e7eb" : "#0f172a",
    cursor: "pointer",
    fontWeight: 900
  })
};