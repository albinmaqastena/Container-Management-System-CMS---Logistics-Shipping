export interface DashboardEntityCounts {
  total: number;
  active: number;
  deleted: number;
}

export interface DashboardContainerStats
  extends DashboardEntityCounts {
  archived: number;
  shipped: number;

  totalCapacity: number;
  usedVolume: number;
  availableVolume: number;
  usagePercentage: number;
}

export interface DashboardItemStats
  extends DashboardEntityCounts {
  totalPackages: number;
  totalProducts: number;
  totalValue: number;
}

export interface DashboardUserStats
  extends DashboardEntityCounts {
  admins: number;
  regularUsers: number;
}

export interface DashboardRecentActivity {
  id: string;
  action: string;
  status: string;
  targetId: string | null;
  targetType: string | null;
  createdAt: string;

  user?: {
    id: string;
    username: string;
    email: string;
  } | null;
}

export interface DashboardSummary {
  containers: DashboardContainerStats;
  items: DashboardItemStats;
  users: DashboardUserStats;

  recentActivity: DashboardRecentActivity[];

  generatedAt: string;
}