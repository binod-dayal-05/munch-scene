import { useState } from "react";
import { ResultPage } from "./pages/ResultPage";
import { mockResolveResult } from "./data/mockResult";
import type { ResolveResult } from "@munchscene/shared";

/** Demo: "resolving" shows loading state; "result" shows mock result. Real app uses room status. */
const DEMO_MODE = "result" as "resolving" | "result";

function App() {
  const [result, setResult] = useState<ResolveResult | null>(
    DEMO_MODE === "result" ? mockResolveResult : null
  );
  const [resolving, setResolving] = useState(DEMO_MODE === "resolving");

  const showResolving = resolving;

  return (
    <div className="app">
      <ResultPage
        result={result}
        resolving={showResolving}
        onResolvingComplete={() => {
          setResult(mockResolveResult);
          setResolving(false);
        }}
      />
    </div>
  );
}

export default App;
