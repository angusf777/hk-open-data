import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { loadCatalogue } from "./data";
import "./styles.css";
import type { Catalogue } from "./types";

function Bootstrap() {
  const [catalogue, setCatalogue] = useState<Catalogue>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    loadCatalogue(controller.signal).then(setCatalogue).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "Catalogue could not be loaded");
      }
    });
    return () => controller.abort();
  }, [attempt]);

  if (error) {
    return (
      <main className="load-state">
        <h1>Catalogue unavailable</h1>
        <p>{error}</p>
        <button type="button" onClick={retry}>
          Retry
        </button>
      </main>
    );
  }
  if (!catalogue) return <p className="load-state">Loading local catalogue…</p>;
  return <App catalogue={catalogue} />;
}

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
