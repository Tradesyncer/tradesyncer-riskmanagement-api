"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutoLiq {
  id: number;
  dailyLossAutoLiq?: number | null;
  dailyProfitAutoLiq?: number | null;
  weeklyLossAutoLiq?: number | null;
  trailingMaxDrawdown?: number | null;
  flattenTimestamp?: string | null;
  doNotUnlock?: boolean | null;
  changesLocked?: boolean | null;
}

interface Account {
  id: number;
  name: string;
  userId: number;
  accountType: string;
  active: boolean;
  autoLiq: AutoLiq | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [environment, setEnvironment] = useState<string>("demo");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Token input
  const [token, setToken] = useState("");
  const [envChoice, setEnvChoice] = useState<"demo" | "live">("demo");

  // Form state per account
  const [forms, setForms] = useState<
    Record<number, { dailyLoss: string; dailyProfit: string; doNotUnlock: boolean }>
  >({});

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 6000);
  };

  // Check if already connected on mount, handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    const codeParam = params.get("code");

    if (errorParam) {
      showMessage(errorParam, "error");
      window.history.replaceState({}, "", "/");
      return;
    }

    // If we got an OAuth code back, exchange it for a token
    if (codeParam) {
      window.history.replaceState({}, "", "/");
      setLoading(true);
      fetch("/api/oauth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeParam }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setConnected(true);
            setEnvironment(data.environment);
            showMessage("Connected to Tradovate via OAuth", "success");
            fetchAccounts();
          } else {
            showMessage(data.error || "OAuth exchange failed", "error");
          }
        })
        .catch(() => showMessage("OAuth exchange failed", "error"))
        .finally(() => setLoading(false));
      return;
    }

    // Otherwise check existing connection
    fetch("/api/connect")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setConnected(true);
          setEnvironment(data.environment);
          fetchAccounts();
        }
      })
      .catch(() => {});
  }, []);

  // Connect with access token
  const connect = async () => {
    if (!token.trim()) {
      showMessage("Please enter an access token", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token.trim(), environment: envChoice }),
      });
      const data = await res.json();
      if (data.success) {
        setConnected(true);
        setEnvironment(data.environment);
        showMessage("Connected to Tradovate", "success");
        await fetchAccounts();
      } else {
        showMessage(data.error || "Connection failed", "error");
      }
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Connection failed",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch accounts
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts);
        const formState: typeof forms = {};
        for (const acct of data.accounts as Account[]) {
          formState[acct.id] = {
            dailyLoss: acct.autoLiq?.dailyLossAutoLiq?.toString() ?? "",
            dailyProfit: acct.autoLiq?.dailyProfitAutoLiq?.toString() ?? "",
            doNotUnlock: acct.autoLiq?.doNotUnlock ?? true,
          };
        }
        setForms(formState);
      } else {
        showMessage(data.error || "Failed to fetch accounts", "error");
      }
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Failed to fetch accounts",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Save risk settings
  const saveSettings = async (accountId: number) => {
    const form = forms[accountId];
    if (!form) return;

    const dailyLoss = form.dailyLoss ? Number(form.dailyLoss) : undefined;
    const dailyProfit = form.dailyProfit ? Number(form.dailyProfit) : undefined;

    if (dailyLoss !== undefined && (isNaN(dailyLoss) || dailyLoss <= 0)) {
      showMessage("Daily loss must be a positive number", "error");
      return;
    }
    if (dailyProfit !== undefined && (isNaN(dailyProfit) || dailyProfit <= 0)) {
      showMessage("Daily profit must be a positive number", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          dailyLossAutoLiq: dailyLoss,
          dailyProfitAutoLiq: dailyProfit,
          doNotUnlock: form.doNotUnlock,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Account ${accountId}: risk limits updated`, "success");
        await fetchAccounts();
      } else {
        showMessage(data.error || "Failed to save settings", "error");
      }
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Failed to save",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (
    accountId: number,
    field: string,
    value: string | boolean
  ) => {
    setForms((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], [field]: value },
    }));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Risk Management
        </h1>
        <p className="mt-1 text-gray-400">
          Set daily loss limits and profit targets on your Tradovate accounts
        </p>
      </div>

      {/* Toast */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Connection */}
      {!connected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2 text-center">
            Connect to Tradovate
          </h2>
          <p className="text-gray-400 text-sm mb-6 text-center">
            Paste your Tradovate access token to get started.
            <br />
            <span className="text-gray-500">
              Get one from the{" "}
              <a
                href="https://api.tradovate.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                API docs
              </a>{" "}
              &quot;Try it!&quot; button, or from your Tradesyncer backend.
            </span>
          </p>

          <div className="space-y-4 max-w-lg mx-auto">
            {/* Environment toggle */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setEnvChoice("demo")}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  envChoice === "demo"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Demo
              </button>
              <button
                onClick={() => setEnvChoice("live")}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  envChoice === "live"
                    ? "bg-red-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                Live
              </button>
            </div>

            {/* Token input */}
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your access token here..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono resize-none"
            />

            <button
              onClick={connect}
              disabled={loading || !token.trim()}
              className="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? "Connecting..." : "Connect with Token"}
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">OR</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <a
              href="/api/oauth/login"
              className="block w-full px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors text-center text-sm"
            >
              Log in with Tradovate (OAuth)
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between mb-6 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-gray-300">
                Connected to{" "}
                <span className="font-semibold text-white uppercase">
                  {environment}
                </span>
              </span>
            </div>
            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Accounts */}
          {accounts.length === 0 && !loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
              No accounts found
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((acct) => {
                const form = forms[acct.id] ?? {
                  dailyLoss: "",
                  dailyProfit: "",
                  doNotUnlock: true,
                };

                return (
                  <div
                    key={acct.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                  >
                    {/* Account header */}
                    <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">
                          {acct.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ID: {acct.id} &middot; {acct.accountType} &middot;{" "}
                          {acct.active ? (
                            <span className="text-emerald-400">Active</span>
                          ) : (
                            <span className="text-red-400">Inactive</span>
                          )}
                        </p>
                      </div>
                      {acct.autoLiq?.changesLocked && (
                        <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded">
                          Locked
                        </span>
                      )}
                    </div>

                    {/* Current settings */}
                    {acct.autoLiq && (
                      <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
                          Current Settings
                        </p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Daily Loss</span>
                            <p className="text-white font-medium">
                              {acct.autoLiq.dailyLossAutoLiq != null
                                ? `$${acct.autoLiq.dailyLossAutoLiq}`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Daily Profit</span>
                            <p className="text-white font-medium">
                              {acct.autoLiq.dailyProfitAutoLiq != null
                                ? `$${acct.autoLiq.dailyProfitAutoLiq}`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Stay Closed</span>
                            <p className="text-white font-medium">
                              {acct.autoLiq.doNotUnlock ? "Yes" : "No"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Edit form */}
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                            Daily Loss Limit ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 500"
                            value={form.dailyLoss}
                            onChange={(e) =>
                              updateForm(acct.id, "dailyLoss", e.target.value)
                            }
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                            Daily Profit Target ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 1000"
                            value={form.dailyProfit}
                            onChange={(e) =>
                              updateForm(acct.id, "dailyProfit", e.target.value)
                            }
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => saveSettings(acct.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {loading ? "Saving..." : "Save Limits"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
