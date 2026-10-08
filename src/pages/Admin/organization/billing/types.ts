import type { Moment, MomentInput } from 'moment';

export type BillingTab = 'purchase' | 'credit' | 'refund' | 'aiBenefit';
export type Granularity = 'day' | 'week' | 'month';
export type BillingAmount = number | string | null | undefined;
export interface DateInfo {
  startDate: string;
  endDate: string;
  searchDateStr?: string | undefined;
  value?: number | undefined;
}
export interface BillingUser {
  accountId?: string | undefined;
  fullName?: string | undefined;
  fullname?: string | undefined;
  avatar?: string | undefined;
}
export interface BillingApplication {
  appId?: string | undefined;
  appName?: string | undefined;
  appIconUrl?: string | undefined;
  appIconColor?: string | undefined;
  createType?: number | undefined;
  urlTemplate?: string | undefined;
  status?: number | undefined;
}
export interface BillingTransaction {
  id?: string | undefined;
  orderId?: string | undefined;
  orderNo?: string | undefined;
  orderStatus?: number | string | undefined;
  orderStatusCode?: number | undefined;
  item?: { productName?: string | undefined; productCode?: number | string } | undefined;
  totalAmount?: BillingAmount | undefined;
  amount?: BillingAmount | undefined;
  amountText?: string | undefined;
  businessType?: number | undefined;
  businessId?: string | undefined;
  businessName?: string | undefined;
  instanceId?: string | undefined;
  traceId?: string | undefined;
  channel?: string | undefined;
  application?: BillingApplication | undefined;
  app?: BillingApplication | undefined;
  operator?: BillingUser | undefined;
  creator?: BillingUser | undefined;
  payer?: BillingUser | undefined;
  createTime?: string | undefined;
  createdAt?: string | undefined;
  paymentTime?: string | undefined;
  payTime?: string | undefined;
  credit?: string | undefined;
  type?: string | undefined;
  business?: string | undefined;
  invoiceStatus?: string | undefined;
  model?: string | undefined;
  scene?: string | undefined;
  agentName?: string | undefined;
  credits?: BillingAmount | undefined;
  freeApplied?: BillingAmount | undefined;
  accountStatus?: string | undefined;
  createAccountInfo?: BillingUser | undefined;
}
export interface BillingDetail {
  traceId?: string | undefined;
  instanceId?: string | undefined;
  amountType: 'credit' | 'aiBenefit';
}
export interface BillingFilters {
  content?: string | undefined;
  orderStatus?: number | undefined;
  type?: number | string | undefined;
  invoiceStatus?: string | undefined;
  creator?: BillingUser[] | undefined;
  time?: Partial<DateInfo> | undefined;
  app?: string | undefined;
  channel?: string | undefined;
}
export interface BillingRequest {
  projectId: string;
  productCode?: string | undefined;
  orderStatuses?: number[] | undefined;
  transactionType?: number | undefined;
  businessTypes?: number[] | undefined;
  operatorAccountId?: string | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  extensionFilters?: { appId?: string | undefined; channel?: string } | undefined;
  pageIndex?: number | undefined;
  pageSize?: number | undefined;
  fileName?: string | undefined;
}
export interface BillingListResult {
  items: BillingTransaction[];
  totalCount: number;
}
export interface BillingBalance {
  balance: number;
}
export interface BillingQuota {
  giftRemaining?: number | undefined;
  monthlyRemaining?: number;
}
export interface BillingPoint {
  bucketStart: number;
  amount: number;
}
export interface BillingSeries {
  businessType?: number | undefined;
  totalAmount: number;
  extensionData?: { businessId?: string | undefined; modelName?: string } | undefined;
  points: BillingPoint[];
}
export interface BillingStatisticsSummary {
  distribution?: { items?: BillingSeries[] } | undefined;
  scenes?: { items?: BillingSeries[] } | undefined;
  trend?: { items?: BillingSeries[] } | undefined;
  models?: { items?: BillingSeries[] } | undefined;
}
export interface ChartDatum {
  date?: string | undefined;
  type: string;
  value: number;
}
export interface BillingAppSummary extends BillingApplication {
  application?: BillingApplication | undefined;
  amount?: number | undefined;
  totalAmount?: number | undefined;
  creditPointAmount?: number | undefined;
  freePointAmount?: number | undefined;
  workflow?: number | undefined;
  worksheet?: number | undefined;
  externalPortal?: number | undefined;
  mingo?: number | undefined;
}
export interface OverviewCard {
  key: 'periodConsumption' | 'totalRecharge' | 'totalConsumption';
  label: string;
  value?: BillingAmount | undefined;
  unit: string;
}
export interface BillingStatisticsState {
  loading: boolean;
  error: string;
  creditDistribution: ChartDatum[];
  mingoDistribution: ChartDatum[];
  credit: ChartDatum[];
  aiModel: ChartDatum[];
  creditTotal: number;
  aiModelTotal: number;
}
export interface BillingProps {
  match: { params: { projectId: string; tab?: string } };
}
export interface DetailsProps {
  projectId: string;
  onRequestParamsChange?: (params: BillingRequest | null) => void;
}
export interface ChartProps {
  type: 'pie' | 'column';
  data?: ChartDatum[] | undefined;
  options?: Record<string, unknown> | undefined;
  total?: number | undefined;
  title: string;
  loading?: boolean | undefined;
  className?: string;
}
export type BillingDateInput = MomentInput | Moment;

export function getBillingErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    if ('errorMessage' in error && typeof error.errorMessage === 'string') return error.errorMessage;
    if (
      'data' in error &&
      error.data &&
      typeof error.data === 'object' &&
      'errorMessage' in error.data &&
      typeof error.data.errorMessage === 'string'
    )
      return error.data.errorMessage;
  }
  return fallback;
}
