// Frontend mirror of backend domain types (kept intentionally small).
export type Category =
  | 'road_infrastructure'
  | 'streetlight'
  | 'waste'
  | 'water'
  | 'drainage'
  | 'public_property'
  | 'other';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Priority = Severity;
export type ReportStatus = 'NEW' | 'AI_ANALYZED' | 'CLUSTERED';
export type IssueStatus =
  | 'NEW'
  | 'AI_ANALYZED'
  | 'VERIFIED'
  | 'IN_PROGRESS'
  | 'RESOLVED';

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
  confidence: number;
  evidence: { text: string[]; image: string[] };
  recommended_action: string;
  reasoning_summary: string;
  degraded?: boolean;
  status?: 'OK' | 'PENDING_RETRY';
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
  imageUrl?: string;
  location?: GeoLocation;
  category?: Category;
  status: ReportStatus;
  severity?: Severity;
  confidence?: number;
  issueId?: string;
  aiAnalysis?: AiAnalysis;
  rekognition?: { labels: { name: string; confidence: number }[]; available: boolean };
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

export interface DashboardStats {
  totals: { reports: number; activeIssues: number; highPriority: number; resolved: number };
  categoryBreakdown: { category: Category; pct: number; count: number }[];
  statusDistribution: { status: string; count: number }[];
  duplicateClusters: number;
  recentReports: Report[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  road_infrastructure: 'Road Infrastructure',
  streetlight: 'Streetlight',
  waste: 'Waste',
  water: 'Water',
  drainage: 'Drainage',
  public_property: 'Public Property',
  other: 'Other',
};
