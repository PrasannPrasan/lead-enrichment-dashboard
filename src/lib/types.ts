export type ProviderName =
  | "proxycurl"
  | "ninjapear"
  | "apollo"
  | "hunter"
  | "pdl"
  | "twilio"
  | "dropcontact"
  | "snov"
  | "findymail";

export type EnrichmentMode = "live" | "mock";

export type LeadField =
  | "fullName"
  | "currentCompany"
  | "currentDesignation"
  | "totalYearsExperience"
  | "emails"
  | "phones"
  | "workHistory";

export type ConfidenceMap = Partial<Record<LeadField, number>>;
export type SourceMap = Partial<Record<LeadField, string[]>>;

export type WorkHistoryItem = {
  company: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
};

export type LeadEnrichment = {
  fullName?: string | null;
  currentCompany?: string | null;
  currentDesignation?: string | null;
  totalYearsExperience?: number | null;
  emails?: string[];
  phones?: string[];
  workHistory?: WorkHistoryItem[];
};

export type ProviderConfigInput = {
  provider: ProviderName | string;
  enabled: boolean;
  priority: number;
  costPerRequest: number;
  costPerSuccessfulContact: number;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
};

export type ProviderLookupContext = {
  linkedinUrl: string;
  leadId: string;
  current: LeadEnrichment;
  enrichmentMode?: EnrichmentMode;
  config: ProviderConfigInput;
};

export type ProviderLookupResult = {
  provider: ProviderName;
  endpoint: string;
  success: boolean;
  skipped?: boolean;
  data?: LeadEnrichment;
  fieldsReturned: LeadField[];
  requestSummary: Record<string, unknown>;
  responseSummary: Record<string, unknown>;
  confidence?: ConfidenceMap;
  sources?: SourceMap;
  cost: number;
  error?: string;
};

export type SerializedLead = {
  id: string;
  linkedinUrl: string;
  fullName: string | null;
  currentCompany: string | null;
  currentDesignation: string | null;
  totalYearsExperience: number | null;
  emails: string[];
  phones: string[];
  workHistory: WorkHistoryItem[];
  confidence: ConfidenceMap;
  sources: SourceMap;
  totalCost: number;
  isCached: boolean;
  createdAt: string;
  updatedAt: string;
};
