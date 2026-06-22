import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {!PUBLISHABLE_KEY ? (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f3f4f6",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "20px"
      }}>
        <h2 style={{ color: "#ef4444", marginBottom: "16px" }}>Configuration Error</h2>
        <p style={{ maxWidth: "500px", lineHeight: "1.6", color: "#9ca3af", fontSize: "16px" }}>
          The Clerk Publishable Key is missing from the build environment.
        </p>
        <p style={{ maxWidth: "500px", lineHeight: "1.6", color: "#9ca3af", marginTop: "12px", fontSize: "14px" }}>
          Please make sure <code>VITE_CLERK_PUBLISHABLE_KEY</code> is defined in your <code>.env</code> file or set up as a GitHub Secret in your repository.
        </p>
      </div>
    ) : (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    )}
  </React.StrictMode>,
);

