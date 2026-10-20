import { describe, it, expect } from "vitest";
import { isTaskArchived, completionFields } from "./doneVisibility";

const now = new Date("2026-10-21T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const done = (extra: Partial<Parameters<typeof isTaskArchived>[0]> = {}) => ({
  status: "termine", completedAt: hoursAgo(1), archivedAt: null, sprint: null, ...extra,
});

describe("isTaskArchived", () => {
  it("never archives a task that is not done", () => {
    expect(isTaskArchived({ ...done({ archivedAt: now }), status: "en_cours" }, { doneVisibility: "immediate", doneVisibilityHours: 1 }, now)).toBe(false);
  });

  it("manual mode only hides tasks removed by hand", () => {
    const settings = { doneVisibility: "manual" as const, doneVisibilityHours: 168 };
    expect(isTaskArchived(done(), settings, now)).toBe(false);
    expect(isTaskArchived(done({ archivedAt: now }), settings, now)).toBe(true);
  });

  it("immediate mode hides every done task", () => {
    expect(isTaskArchived(done(), { doneVisibility: "immediate", doneVisibilityHours: 168 }, now)).toBe(true);
  });

  it("delay mode hides done tasks once the delay is over", () => {
    const settings = { doneVisibility: "delay" as const, doneVisibilityHours: 48 };
    expect(isTaskArchived(done({ completedAt: hoursAgo(47) }), settings, now)).toBe(false);
    expect(isTaskArchived(done({ completedAt: hoursAgo(48) }), settings, now)).toBe(true);
    expect(isTaskArchived(done({ completedAt: null }), settings, now)).toBe(false);
  });

  it("sprint_end mode hides done tasks of completed sprints", () => {
    const settings = { doneVisibility: "sprint_end" as const, doneVisibilityHours: 168 };
    expect(isTaskArchived(done({ sprint: { status: "actif" } }), settings, now)).toBe(false);
    expect(isTaskArchived(done({ sprint: { status: "termine" } }), settings, now)).toBe(true);
    expect(isTaskArchived(done(), settings, now)).toBe(false);
  });
});

describe("completionFields", () => {
  it("stamps completion when a task becomes done", () => {
    expect(completionFields("en_cours", "termine").completedAt).toBeInstanceOf(Date);
  });

  it("clears completion and manual archive when a done task is reopened", () => {
    expect(completionFields("termine", "a_faire")).toEqual({ completedAt: null, archivedAt: null });
  });

  it("leaves fields untouched otherwise", () => {
    expect(completionFields("termine", "termine")).toEqual({});
    expect(completionFields("a_faire", undefined)).toEqual({});
    expect(completionFields("a_faire", "en_cours")).toEqual({});
  });
});
