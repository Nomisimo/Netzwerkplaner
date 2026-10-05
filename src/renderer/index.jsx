import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { HELL, THEME_VARS } from "../shared/constants.js";

// Farben des gewählten Erscheinungsbilds als CSS-Variablen (für styles.css)
const root = document.documentElement;
root.dataset.theme = HELL ? "hell" : "dunkel";
root.style.colorScheme = HELL ? "light" : "dark";
for (const [k, v] of Object.entries(THEME_VARS)) root.style.setProperty(`--np-${k.toLowerCase()}`, v);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
