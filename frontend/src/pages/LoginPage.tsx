import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { UserRole } from "../types";

const roleCopy: Record<UserRole, { label: string; description: string }> = {
  OWNER: {
    label: "Owner",
    description: "Manage the pipeline, assignments, and tenant operations.",
  },
  AGENT: {
    label: "Agent",
    description:
      "Work your queue, update lead progress, and close opportunities.",
  },
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("OWNER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, role);
      navigate("/leads", { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-intro">
        <p className="eyebrow">Leadflow workspace</p>
        <h1>Turn every conversation into momentum.</h1>
        <p className="intro-copy">
          A calm, focused command center for teams that care where every lead
          goes next.
        </p>
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
          {(["OWNER", "AGENT"] as UserRole[]).map((option) => (
            <button
              type="button"
              key={option}
              className={role === option ? "role-option active" : "role-option"}
              onClick={() => setRole(option)}
            >
              <span>{roleCopy[option].label}</span>
              <small>
                {option === "OWNER" ? "Workspace control" : "Lead workspace"}
              </small>
            </button>
          ))}
        </div>
        <p className="role-description">{roleCopy[role].description}</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              minLength={8}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            type="submit"
            className="primary-button login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : `Continue as ${roleCopy[role].label}`}
          </button>
        </form>
        <p className="login-footnote">
          Your access is scoped to the tenant in your account.
        </p>
      </section>
    </main>
  );
}
