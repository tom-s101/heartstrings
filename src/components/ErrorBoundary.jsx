import { Component } from "react";
import { C, Icon } from "../ui";

/* ============================================================================
   ErrorBoundary — the app's crash safety net.
   Wraps each tab (Questions / Drawing / Creative / Gallery) individually. If a
   render throws — e.g. a malformed or unexpectedly-shaped piece of synced
   state slipped through — only that tab shows a recovery card instead of the
   whole app going blank. "Reset this section" clears just that slice of
   synced state back to defaults; everything else (the room, your account,
   the other tabs, saved gallery items) is untouched.
   ============================================================================ */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, resetting: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // Visible in the browser console / Netlify function logs are irrelevant here —
    // this runs client-side. Left in intentionally so it's diagnosable later.
    console.error("Heartstrings — section crashed:", error, info?.componentStack);
  }
  handleReset = async () => {
    this.setState({ resetting: true });
    try {
      await this.props.onReset?.();
    } catch (e) {
      console.error("reset failed:", e);
    }
    this.setState({ hasError: false, resetting: false });
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        textAlign: "center", padding: "40px 24px", borderRadius: 22,
        background: "rgba(255,255,255,.9)", border: "1px solid rgba(255,255,255,.7)",
        boxShadow: "0 24px 50px -28px rgba(70,60,50,.4)",
      }}>
        <div style={{ display: "inline-flex", marginBottom: 10 }}>
          <Icon name="leaf" size={30} color={C.roseDeep} />
        </div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
          This section hit a snag
        </div>
        <p style={{ color: C.inkSoft, fontSize: 14, maxWidth: 360, margin: "0 auto 18px", lineHeight: 1.5 }}>
          Something in this room's saved state didn't load right. Resetting just
          this section should fix it — your room, account, and everything else
          stay exactly as they were.
        </p>
        <button
          className="press"
          onClick={this.handleReset}
          disabled={this.state.resetting}
          style={{
            border: "none", borderRadius: 14, padding: "12px 22px",
            background: `linear-gradient(90deg, ${C.blue}, ${C.rose})`, color: "#fff",
            fontWeight: 800, fontSize: 14, cursor: this.state.resetting ? "wait" : "pointer",
            opacity: this.state.resetting ? .6 : 1,
          }}
        >
          {this.state.resetting ? "resetting…" : "Reset this section"}
        </button>
      </div>
    );
  }
}
