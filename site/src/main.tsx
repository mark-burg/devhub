import { render } from "preact";
import "./styles/app.css";
import { App } from "./app";
import { startRouter } from "./router";
import { load } from "./state";

startRouter();
render(<App />, document.getElementById("root")!);
void load();
