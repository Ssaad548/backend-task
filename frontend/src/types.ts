export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'WON'
  | 'LOST'
  | 'FOLLOW_UP_REQUIRED'

export type UserRole = 'OWNER' | 'AGENT'

export type AuthUser = {
  id: string
  name: string
  email: string
  tenantId: string
  role: UserRole
}

export type Agent = {
  id: string
  name: string
  email: string
}

export type Lead = {
  id: string
  tenant_id: string
  name: string
  email: string
  phone: string | null
  source: string | null
  status: LeadStatus
  assigned_to: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; name: string } | null
}

export type LeadListResponse = {
  data: Lead[]
  meta: { page: number; limit: number; total: number }
}