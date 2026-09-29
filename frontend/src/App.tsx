import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST' | 'FOLLOW_UP_REQUIRED'

type Lead = {
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
}

type UserRole = 'OWNER' | 'AGENT'

type AuthUser = {
  id: string
  name: string
  email: string
  tenantId: string
  role: UserRole
}

type LoginRole = UserRole

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  source: 'Website',
  status: 'NEW' as LeadStatus,
}

const statLabels: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  WON: 'Won',
  LOST: 'Lost',
  FOLLOW_UP_REQUIRED: 'Follow Up Required',
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const roleCopy: Record<LoginRole, { label: string; description: string }> = {
  OWNER: {
    label: 'Owner',
    description: 'Manage the pipeline, assignments, and tenant operations.',
  },
  AGENT: {
    label: 'Agent',
    description: 'Work your queue, update lead progress, and close opportunities.',
  },
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = sessionStorage.getItem('leadflow_user')
    return savedUser ? (JSON.parse(savedUser) as AuthUser) : null
  })
  const [loginRole, setLoginRole] = useState<LoginRole>('OWNER')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [form, setForm] = useState(emptyForm)
  const [selectedStatus, setSelectedStatus] = useState<'all' | LeadStatus>('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadLeads = async (status?: 'all' | LeadStatus) => {
    try {
      setLoading(true)
      const query = status && status !== 'all' ? `?status=${status}` : ''
      const token = sessionStorage.getItem('leadflow_token')
      const response = await fetch(`${apiUrl}/leads${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = (await response.json()) as { data?: Lead[]; message?: string }
      if (!response.ok || !data.data) {
        throw new Error(data.message ?? 'Request failed')
      }
      setLeads(data.data)
    } catch {
      setError('Unable to load leads from the API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return

    const loadTimer = window.setTimeout(() => {
      void loadLeads(selectedStatus)
    }, 0)

    return () => window.clearTimeout(loadTimer)
  }, [selectedStatus, user])

  const summary = useMemo(() => {
    const counts = {
      total: leads.length,
      new: leads.filter((lead) => lead.status === 'NEW').length,
      contacted: leads.filter((lead) => lead.status === 'CONTACTED').length,
      qualified: leads.filter((lead) => lead.status === 'QUALIFIED').length,
      won: leads.filter((lead) => lead.status === 'WON').length,
    }

    return counts
  }, [leads])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      source: form.source,
    }

    try {
      const token = sessionStorage.getItem('leadflow_token')
      const response = await fetch(`${apiUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      setForm(emptyForm)
      await loadLeads(selectedStatus)
    } catch {
      setError('Unable to create the lead record.')
    }
  }

  const handleStatusChange = (nextStatus: 'all' | LeadStatus) => {
    setSelectedStatus(nextStatus)
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await response.json()) as { access_token?: string; user?: AuthUser; message?: string | string[] }

      if (!response.ok || !data.access_token || !data.user) {
        throw new Error(Array.isArray(data.message) ? data.message[0] : data.message ?? 'Unable to sign in.')
      }

      if (data.user.role !== loginRole) {
        throw new Error(`This account is an ${roleCopy[data.user.role].label} account. Choose the ${roleCopy[data.user.role].label} login.`)
      }

      sessionStorage.setItem('leadflow_token', data.access_token)
      sessionStorage.setItem('leadflow_user', JSON.stringify(data.user))
      setUser(data.user)
      setPassword('')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('leadflow_token')
    sessionStorage.removeItem('leadflow_user')
    setUser(null)
    setEmail('')
    setPassword('')
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-intro">
          <p className="eyebrow">Leadflow workspace</p>
          <h1>Turn every conversation into momentum.</h1>
          <p className="intro-copy">A calm, focused command center for teams that care where every lead goes next.</p>
          <div className="intro-rule" />
          <p className="intro-note">Tenant-aware access for owners and agents.</p>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-heading">
            <span className="brand-mark">L</span>
            <div>
              <p className="eyebrow">Welcome back</p>
              <h2 id="login-title">Sign in to Leadflow</h2>
            </div>
          </div>

          <div className="role-switcher" aria-label="Choose account type">
            {(['OWNER', 'AGENT'] as LoginRole[]).map((role) => (
              <button
                type="button"
                key={role}
                className={loginRole === role ? 'role-option active' : 'role-option'}
                onClick={() => setLoginRole(role)}
              >
                <span>{roleCopy[role].label}</span>
                <small>{role === 'OWNER' ? 'Workspace control' : 'Lead workspace'}</small>
              </button>
            ))}
          </div>

          <p className="role-description">{roleCopy[loginRole].description}</p>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Work email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" minLength={8} required />
            </label>
            {loginError ? <p className="form-error">{loginError}</p> : null}
            <button type="submit" className="primary-button login-button" disabled={loginLoading}>
              {loginLoading ? 'Signing in...' : `Continue as ${roleCopy[loginRole].label}`}
            </button>
          </form>
          <p className="login-footnote">Your access is scoped to the tenant in your account.</p>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lead pipeline</p>
          <h1>{user.role === 'OWNER' ? 'Workspace command center' : 'Your lead workspace'}</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <span className="user-avatar">{user.name.charAt(0)}</span>
            <span><strong>{user.name}</strong><small>{roleCopy[user.role].label} · {user.tenantId.slice(0, 8)}</small></span>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <div className="filter-row">
        <p className="section-kicker">Pipeline view</p>
        <div className="status-pills">
          <button className={selectedStatus === 'all' ? 'pill active' : 'pill'} onClick={() => handleStatusChange('all')}>
            All
          </button>
          {Object.entries(statLabels).map(([value, label]) => (
            <button
              key={value}
              className={selectedStatus === value ? 'pill active' : 'pill'}
              onClick={() => handleStatusChange(value as LeadStatus)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="stat-card">
          <span>New</span>
          <strong>{summary.new}</strong>
        </article>
        <article className="stat-card">
          <span>Contacted</span>
          <strong>{summary.contacted}</strong>
        </article>
        <article className="stat-card">
          <span>Qualified</span>
          <strong>{summary.qualified}</strong>
        </article>
        <article className="stat-card">
          <span>Won</span>
          <strong>{summary.won}</strong>
        </article>
      </section>

      <section className="content-grid">
        <div className="panel table-panel">
          <div className="panel-header">
            <h2>Recent leads</h2>
          </div>

          {loading ? (
            <p className="empty-state">Loading leads…</p>
          ) : leads.length === 0 ? (
            <p className="empty-state">No leads found for this filter.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div className="lead-name">{lead.name}</div>
                      <small>{lead.email}</small>
                    </td>
                    <td>{lead.phone ?? '—'}</td>
                    <td>{lead.source ?? '—'}</td>
                    <td>
                      <span className={`status status-${lead.status.toLowerCase()}`}>{statLabels[lead.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="panel form-panel">
          <div className="panel-header">
            <h2>Add lead</h2>
          </div>

          <form onSubmit={handleSubmit} className="lead-form">
            <label>
              Full name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter full name" />
            </label>

            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Enter email" />
            </label>

            <label>
              Phone
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+8801xxxxxxxxx" />
            </label>

            <div className="two-column">
              <label>
                Source
                <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
                  <option value="Website">Website</option>
                  <option value="Outbound">Outbound</option>
                  <option value="Referral">Referral</option>
                  <option value="Partner">Partner</option>
                </select>
              </label>

              <label>
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeadStatus })}>
                  {Object.entries(statLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="form-error">{error}</p> : null}

            <button type="submit" className="primary-button">
              Save lead
            </button>
          </form>
        </aside>
      </section>
    </div>
  )
}

export default App
