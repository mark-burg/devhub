import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/preact";
import { RunsTable } from "./components/RunsTable";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./views/Dashboard";
import { RunChart } from "./charts/RunChart";
import { allRuns, getReport } from "./selectors";
import { parse } from "./router";
import { hub } from "./test/fixtures";

describe("RunsTable", () => {
  it("links live runs, marks archived ones and dashes runs without stats", () => {
    const h = hub();
    render(<RunsTable rows={allRuns(h)} label="Runs" showReport />);
    expect(screen.getAllByRole("link", { name: "#3" })[0].getAttribute("href")).toBe("#/r/web/e2e/3");
    const archived = screen.getByTitle(/Report files were pruned/);
    expect(archived.tagName).toBe("SPAN");
    const coverageRow = screen.getAllByText("Web / Coverage")[0].closest("tr")!;
    expect(within(coverageRow).getAllByText("—").length).toBeGreaterThanOrEqual(6);
  });

  it("expands beyond the limit on request", () => {
    const h = hub();
    const rows = getReport(h, "web", "e2e")!.runs.map((run) => ({ project: h.projects[0], report: getReport(h, "web", "e2e")!, run }));
    render(<RunsTable rows={rows} label="Runs" limit={2} />);
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
    fireEvent.click(screen.getByRole("button", { name: /Show all 3 runs/ }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
});

describe("Dashboard", () => {
  it("summarises the latest runs and lists failing reports", () => {
    render(<Dashboard hub={hub()} />);
    const failing = screen.getByText("Failing reports").closest(".tile")!;
    expect(within(failing as HTMLElement).getByText("1")).toBeTruthy();
    const attention = screen.getByText("Needs attention").closest("section")!;
    expect(within(attention as HTMLElement).getByText("Api / Unit")).toBeTruthy();
    // web/e2e is judged by its latest main run (#2, passed), not the red feature-branch run.
    expect(within(attention as HTMLElement).queryByText(/Web \/ E2E/)).toBeNull();
  });

  it("shows onboarding when nothing is published", () => {
    const empty = { ...hub(), projects: [] };
    render(<Dashboard hub={empty} />);
    expect(screen.getByText("No reports published yet")).toBeTruthy();
  });
});

describe("Sidebar", () => {
  it("shows failing counts, metric hints, links and the active item", () => {
    render(<Sidebar hub={hub()} route={parse("#/r/web/coverage/2")} />);
    const unit = screen.getByText("Unit").closest("a")!;
    expect(within(unit).getByText("1")).toBeTruthy();
    const coverage = screen.getByText("Coverage").closest("a")!;
    expect(within(coverage).getByText("81.5%")).toBeTruthy();
    expect(coverage.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /External Site/ }).getAttribute("target")).toBe("_blank");
  });
});

describe("RunChart", () => {
  const labels = ["#1", "#2", "#3"];

  it("draws one column per run with rounded tops", () => {
    const { container } = render(
      <RunChart kind="stack" labels={labels} series={[
        { key: "passed", name: "Passed", color: "green", values: [8, 9, 7] },
        { key: "failed", name: "Failed", color: "red", values: [0, 0, 2] },
      ]} />,
    );
    const paths = container.querySelectorAll(".marks path");
    expect(paths).toHaveLength(4); // 3 passed + 1 failed segment
    expect(container.querySelector(".legend")?.textContent).toContain("Failed");
  });

  it("supports keyboard navigation and Enter to open", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <RunChart kind="line" labels={labels} onSelect={onSelect} yFormat={(v) => `${v}s`}
        series={[{ key: "d", name: "Duration", color: "blue", values: [3, null, 5] }]} />,
    );
    const svg = container.querySelector("svg")!;
    expect(container.querySelector(".value-label")?.textContent).toBe("5s");
    fireEvent.focus(svg);
    expect(container.querySelector(".chart-tip .tip-title")?.textContent).toBe("#3");
    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    expect(container.querySelector(".chart-tip strong")?.textContent).toBe("—");
    fireEvent.keyDown(svg, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
