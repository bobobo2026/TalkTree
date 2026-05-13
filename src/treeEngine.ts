import type { SegmentAnalysis, TreeEvent } from "./types";

export function treeEventFromAnalysis(analysis: SegmentAnalysis): TreeEvent {
  if (analysis.transition === "shift") {
    return {
      type: "shift_branch",
      intensity: Math.max(0.35, analysis.driftLevel),
      label: analysis.branchLabel || "话题跳转",
      expressionMode: analysis.expressionMode,
      timestamp: Date.now()
    };
  }

  if (analysis.mode === "branch" || analysis.transition === "branch") {
    return {
      type: "grow_branch",
      intensity: Math.max(0.25, analysis.driftLevel),
      label: analysis.branchLabel || "新分支",
      expressionMode: analysis.expressionMode,
      timestamp: Date.now()
    };
  }

  if (analysis.mode === "return" || analysis.transition === "return") {
    return {
      type: "return_to_trunk",
      intensity: 0.55,
      label: "回到主线",
      expressionMode: analysis.expressionMode,
      timestamp: Date.now()
    };
  }

  if (analysis.mode === "uncertain") {
    return {
      type: "uncertain",
      intensity: 0.25,
      label: analysis.branchLabel || "观察中",
      expressionMode: analysis.expressionMode,
      timestamp: Date.now()
    };
  }

  return {
    type: "grow_trunk",
    intensity: analysis.mode === "establishing" ? 0.35 : Math.max(0.35, 1 - analysis.driftLevel),
    label: analysis.mode === "establishing" ? "形成主线" : "延续主线",
    expressionMode: analysis.expressionMode,
    timestamp: Date.now()
  };
}
