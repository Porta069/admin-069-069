"use client";

// Fängt Fehler, die sogar das Root-Layout betreffen. Muss <html>/<body> selbst
// rendern und darf keine App-Komponenten voraussetzen.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f4f4f5",
          color: "#1f2937",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Unerwarteter Fehler</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 16px", maxWidth: 360 }}>
            Die Anwendung konnte nicht geladen werden. Bitte versuch es erneut.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#e8590c",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
