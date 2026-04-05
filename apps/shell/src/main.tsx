import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Shell root element '#root' not found.");
}

createRoot(rootElement).render(
  <App />,
);
