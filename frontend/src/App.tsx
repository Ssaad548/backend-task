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
  FOLLOW_UP_REQUIRED: 'Follow Up',
}

function App() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [form, setForm] = useState(emptyForm)
  const [selectedStatus, setSelectedStatus] = useState<'all' | LeadStatus>('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadLeads = async (status?: 'all' | LeadStatus) => {
    try {
      setLoading(true)
      const query = status && status !== 'all' ? `?status=${status}` : ''
      const response = await fetch(`http://localhost:3000/leads${query}`)
      const data = await response.json()
      setLeads(data)
    } catch {
      setError('Unable to load leads from the API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLeads(selectedStatus)
  }, [selectedStatus])

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
      const response = await fetch('http://localhost:3000/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lead pipeline</p>
          <h1>Leadflow dashboard</h1>
        </div>
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
      </header>

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
