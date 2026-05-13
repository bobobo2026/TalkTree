export type AnalysisMode = "establishing" | "trunk" | "branch" | "return" | "uncertain";
export type ExpressionMode = "forming" | "anchored" | "exploratory";
export type TopicTransition = "continue" | "branch" | "return" | "shift" | "uncertain";

export interface SpeechSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface InferredTopicState {
  mainThread: string;
  expressionMode: ExpressionMode;
  rootTopic: string;
  currentTopic: string;
  topicPath: string[];
  recentSubtopics: string[];
  confidence: number;
}

export interface SegmentAnalysis {
  mode: AnalysisMode;
  expressionMode: ExpressionMode;
  transition: TopicTransition;
  branchLabel: string;
  driftLevel: number;
  reason: string;
  topicState: InferredTopicState;
}

export type TreeEventType = "grow_trunk" | "grow_branch" | "return_to_trunk" | "shift_branch" | "uncertain";

export interface TreeEvent {
  type: TreeEventType;
  intensity: number;
  label: string;
  expressionMode?: ExpressionMode;
  timestamp: number;
}

export interface AnalyzerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  transcriptionModel: string;
  realtimeModel: string;
}
