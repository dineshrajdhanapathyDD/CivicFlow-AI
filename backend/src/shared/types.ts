// Core domain types for CivicFlow AI.

export const CATEGORIES = [
  'road_infrastructure',
  'streetlight',
  'waste',
  'water',
  'drainage',
  'public_property',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export type Priority = Severity; // same buckets

export const REPORT_STATUSES = ['NEW', 'AI_ANALYZED', 'CLUSTERED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ISSUE_STATUSES = [
  'NEW',
  'AI_ANALYZED',
  'VERIFIED',
  'IN_PROGRESS',
  'RESOLVED',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface GeoLocation {
  label?: string;
  lat?: number;
  lng?: number;
}

export interface AiAnalysis {
  category: Category;
  issue_type: string;
  summary: string;
  severity: Severity;
  confidence: number; // 0..1
  evidence: {
    text: string[];
    image: string[];
  };
  recommended_action: string;
  reasoning_summary: string;
  // operational flags (not from the model)
  status?: 'OK' | 'PENDING_RETRY';
  degraded?: boolean; // true when heuristic fallback was used
  analyzedAt?: string;
}

export interface RekognitionResult {
  labels: { name: string; confidence: number }[];
  available: boolean;
}

export interface PriorityFactor {
  label: string;
  points: number;
}

export interface Report {
  reportId: string;
  userId: string;
  createdAt: string;
  title: string;
  text: string;
  imageKey?: string;
  imageUrl?: string;
  location?: GeoLocation;
  category?: Category;
  status: ReportStatus;
  severity?: Severity;
  confidence?: number;
  issueId?: string;
  aiAnalysis?: AiAnalysis;
  rekognition?: RekognitionResult;
}

export interface Issue {
  issueId: string;
  category: Category;
  issueType: string;
  summary: string;
  severity: Severity;
  priority: Priority;
  priorityFactors: PriorityFactor[];
  status: IssueStatus;
  location?: GeoLocation;
  reportCount: number;
  confidence: number;
  recommendedAction: string;
  reportIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  name?: string;
  role: 'citizen' | 'admin';
  createdAt: string;
}

export interface SimilarMatch {
  reportId: string;
  issueId?: string;
  score: number;
}

// Standard API envelope
export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
