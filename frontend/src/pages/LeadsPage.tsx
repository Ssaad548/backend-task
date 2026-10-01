import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage, getAgents } from "../api";
import { useAuth } from "../auth/useAuth";
import { useLeadSocket } from "../hooks/useLeadSocket";
import type { Agent, Lead, LeadListResponse, LeadStatus } from "../types";

const statLabels: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  WON: "Won",
  LOST: "Lost",
  FOLLOW_UP_REQUIRED: "Follow Up",
};
const nextStatuses: Partial<Record<LeadStatus, LeadStatus>> = {
  NEW: "CONTACTED",
  FOLLOW_UP_REQUIRED: "CONTACTED",
  CONTACTED: "QUALIFIED",
  QUALIFIED: "WON",
};
const emptyForm = { name: "", email: "", phone: "", source: "Website" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function LeadsPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<"all" | LeadStatus>(
    "all",
  );
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const upsertLead = useCallback(
    (incoming: Lead) => {
      setLeads((current) => {
        const withoutIncoming = current.filter(
          (lead) => lead.id !== incoming.id,
        );
        return selectedStatus !== "all" && incoming.status !== selectedStatus
          ? withoutIncoming
          : [incoming, ...withoutIncoming];
      });
    },
    [selectedStatus],
  );

  useLeadSocket(token, upsertLead);

  useEffect(() => {
    setLeads([]);
    setAgents([]);
    setAssignments({});
    setSelectedStatus("all");
    setForm(emptyForm);
    setError("");

    if (!user || user.role !== "OWNER") return;

    let active = true;
    void getAgents()
      .then((response) => {
        if (active) setAgents(response.data);
      })
      .catch((loadError) => {
        if (active)
          setError(
            apiErrorMessage(loadError, "Unable to load agents from the API."),
          );
      });

    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<LeadListResponse>("/leads", {
        params: selectedStatus === "all" ? {} : { status: selectedStatus },
      });
      setLeads(response.data.data);
      setError("");
    } catch (loadError) {
      setError(
        apiErrorMessage(loadError, "Unable to load leads from the API."),
      );
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, user?.id]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLeads();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadLeads]);

  const summary = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((lead) => lead.status === "NEW").length,
      contacted: leads.filter((lead) => lead.status === "CONTACTED").length,
      qualified: leads.filter((lead) => lead.status === "QUALIFIED").length,
      won: leads.filter((lead) => lead.status === "WON").length,
    }),
    [leads],
  );

  const mutateLead = async (action: () => Promise<void>) => {
    try {
      setError("");
      await action();
      window.location.reload();
    } catch (mutationError) {
      setError(
        apiErrorMessage(mutationError, "The lead could not be updated."),
      );
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await mutateLead(async () => {
      await api.post("/leads", { ...form, phone: form.phone || null });
      setForm(emptyForm);
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  if (!user) return null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lead pipeline</p>
          <h1>
            {user.role === "OWNER"
              ? "Workspace command center"
              : "Your lead workspace"}
          </h1>
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <span className="user-avatar">{user.name.charAt(0)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.role} · {user.tenantId.slice(0, 8)}
              </small>
            </span>
          </div>
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>
      <div className="filter-row">
        <p className="section-kicker">Pipeline view</p>
        <div className="status-pills">
          <button
            className={selectedStatus === "all" ? "pill active" : "pill"}
            onClick={() => setSelectedStatus("all")}
          >
            All
          </button>
          {Object.entries(statLabels).map(([value, label]) => (
            <button
              key={value}
              className={selectedStatus === value ? "pill active" : "pill"}
              onClick={() => setSelectedStatus(value as LeadStatus)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <section className="stats-grid">
        {Object.entries({
          Total: summary.total,
          New: summary.new,
          Contacted: summary.contacted,
          Qualified: summary.qualified,
          Won: summary.won,
        }).map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      {error ? <p className="form-error page-error">{error}</p> : null}
      <section className="content-grid">
        <div className="panel table-panel">
          <div className="panel-header">
            <h2>Recent leads</h2>
            <span className="live-indicator">Live updates on</span>
          </div>
          {loading ? (
            <p className="empty-state">Loading leads...</p>
          ) : leads.length === 0 ? (
            <p className="empty-state">No leads found for this filter.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Status</th>
                    <th>Assigned agent</th>
                    <th>Source</th>
                    <th>Last updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const canManage =
                      user.role === "OWNER" || lead.assigned_to === user.id;
                    const nextStatus = nextStatuses[lead.status];
                    return (
                      <tr key={lead.id}>
                        <td>
                          <div className="lead-name">{lead.name}</div>
                          <small>{lead.email}</small>
                        </td>
                        <td>
                          <span
                            className={`status status-${lead.status.toLowerCase()}`}
                          >
                            {statLabels[lead.status]}
                          </span>
                        </td>
                        <td>{lead.assignee?.name ?? "Unassigned"}</td>
                        <td>{lead.source ?? "—"}</td>
                        <td>{formatDate(lead.updated_at)}</td>
                        <td>
                          <div className="row-actions">
                            {canManage && nextStatus ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  void mutateLead(async () => {
                                    await api.patch(
                                      `/leads/${lead.id}/status`,
                                      { status: nextStatus },
                                    );
                                  })
                                }
                              >
                                {statLabels[nextStatus]}
                              </button>
                            ) : null}
                            {canManage &&
                            lead.status !== "LOST" &&
                            lead.status !== "WON" ? (
                              <button
                                type="button"
                                className="table-action danger"
                                onClick={() => {
                                  const reason = window.prompt(
                                    "Why is this lead lost?",
                                  );
                                  if (reason)
                                    void mutateLead(async () => {
                                      await api.patch(
                                        `/leads/${lead.id}/lost`,
                                        { reason },
                                      );
                                    });
                                }}
                              >
                                Mark lost
                              </button>
                            ) : null}
                            {user.role === "OWNER" &&
                            lead.status !== "LOST" &&
                            lead.status !== "WON" ? (
                              <form
                                className="assign-form"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const agentId = assignments[lead.id];
                                  if (agentId)
                                    void mutateLead(async () => {
                                      await api.patch(
                                        `/leads/${lead.id}/assign`,
                                        { assignedTo: agentId },
                                      );
                                    });
                                }}
                              >
                                <select
                                  aria-label={`Agent for ${lead.name}`}
                                  value={assignments[lead.id] ?? ""}
                                  onChange={(event) =>
                                    setAssignments((current) => ({
                                      ...current,
                                      [lead.id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="" disabled>
                                    Select agent
                                  </option>
                                  {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                      {agent.name} ({agent.email})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  className="table-action"
                                  disabled={!assignments[lead.id]}
                                >
                                  Assign
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {user.role === "OWNER" ? (
          <aside className="panel form-panel">
            <div className="panel-header">
              <h2>Add lead</h2>
            </div>
            <form onSubmit={handleCreate} className="lead-form">
              <label>
                Full name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </label>
              <label>
                Source
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm({ ...form, source: event.target.value })
                  }
                >
                  <option>Website</option>
                  <option>Outbound</option>
                  <option>Referral</option>
                  <option>Partner</option>
                </select>
              </label>
              <button type="submit" className="primary-button">
                Save lead
              </button>
            </form>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
