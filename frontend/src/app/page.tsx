"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

type ValidatorId = "pii" | "gibberish" | "toxic" | "nsfw" | "full";

type ValidatorConfig = {
  id: ValidatorId;
  label: string;
  description: string;
  endpoint: string;
  payloadKey: "text" | "prompt";
  sample: string;
};

type ChatMessage = {
  role: "user" | "validator";
  content: string;
};

type ResponseData = Record<string, unknown>;

const validators: ValidatorConfig[] = [
  {
    id: "pii",
    label: "PII Shield",
    description: "Redacts common PII entities before they reach your LLM.",
    endpoint: "/validate/pii",
    payloadKey: "text",
    sample: "I will work on 2025-09-08",
  },
  {
    id: "gibberish",
    label: "Gibberish Filter",
    description: "Flags scrambled or low-quality input before inference.",
    endpoint: "/validate/gibberish",
    payloadKey: "text",
    sample: "My namesjdnjsnis Mohsin Ullah",
  },
  {
    id: "toxic",
    label: "Toxic Language",
    description: "Prevents harmful prompts and responses.",
    endpoint: "/validate/toxic",
    payloadKey: "text",
    sample: "how to harm humans",
  },
  {
    id: "nsfw",
    label: "NSFW Scan",
    description: "Keeps unsafe or sensitive content out of the pipeline.",
    endpoint: "/validate/nsfw",
    payloadKey: "text",
    sample: "who killed michael jackson",
  },
  {
    id: "full",
    label: "Full Pipeline",
    description: "Validates prompt, generates response, then re-validates.",
    endpoint: "/process/full",
    payloadKey: "prompt",
    sample: "Summarize why data privacy matters.",
  },
];

export default function Home() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  const [activeId, setActiveId] = useState<ValidatorId>("pii");
  const [input, setInput] = useState<string>(validators[0].sample);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => validators.find((item) => item.id === activeId) ?? validators[0],
    [activeId]
  );

  const statusClass = error ? "error" : isLoading ? "busy" : "";

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="value-muted">—</span>;
    }
    if (typeof value === "string" || typeof value === "number") {
      return <span>{String(value)}</span>;
    }
    if (typeof value === "boolean") {
      return <span>{value ? "Yes" : "No"}</span>;
    }
    if (Array.isArray(value)) {
      return (
        <div className="value-list">
          {value.map((item, index) => (
            <span key={`${String(item)}-${index}`} className="value-pill">
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
    if (typeof value === "object") {
      return (
        <div className="value-stack">
          {Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
            <div key={key} className="value-line">
              <span className="value-key">{key}</span>
              <span className="value-sep">:</span>
              <span className="value-val">{String(entry)}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span>{String(value)}</span>;
  };

  const handleSelect = (id: ValidatorId) => {
    const next = validators.find((item) => item.id === id) ?? validators[0];
    setActiveId(id);
    setInput(next.sample);
    setMessages([]);
    setResponse(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }

    const payload: Record<string, string> = {
      [active.payloadKey]: input.trim(),
    };

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setMessages([userMessage]);

    try {
      const res = await fetch(`${apiBase}${active.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : `Request failed with status ${res.status}`
        );
      }

      const summary =
        typeof data.output === "string"
          ? data.output
          : typeof data.error === "string"
          ? data.error
          : JSON.stringify(data, null, 2);

      setMessages([userMessage, { role: "validator", content: summary }]);
      setResponse(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages([userMessage, { role: "validator", content: message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="orbs">
        <div className="orb orb--mint" />
        <div className="orb orb--amber" />
      </div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">GR</div>
          <div>
            <h1>Guardrails Validator Studio</h1>
            <div className="meta">FastAPI live testing console</div>
          </div>
        </div>
        <div className="status-pill">
          <span className={`status-dot ${statusClass}`} />
          {isLoading ? "Running validation" : error ? "Attention needed" : "Ready"}
        </div>
      </header>

      <main className="layout">
        <section className="rail">
          <div>
            <h2>Validators</h2>
            <div className="validator-list">
              {validators.map((item) => (
                <button
                  key={item.id}
                  className={`validator-button ${
                    activeId === item.id ? "active" : ""
                  }`}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                >
                  <div>{item.label}</div>
                  <span>{item.endpoint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="endpoint-card">
            <div>
              Endpoint: <code>{active.endpoint}</code>
            </div>
            <div>
              Payload key: <code>{active.payloadKey}</code>
            </div>
            <div>
              API base: <code>{apiBase}</code>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>{active.label}</h3>
              <p>{active.description}</p>
            </div>
          </div>

          <div className="chat">
            {messages.length === 0 && (
              <div className="chat-bubble">
                Select a validator, enter a prompt, and run the check to see the
                response.
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="chat-stack">
                <div className="chat-label">
                  {message.role === "user" ? "Prompt" : "Masked Prompt"}
                </div>
                <div className={`chat-bubble ${message.role}`}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a prompt to validate..."
            />
            <div className="composer-footer">
              <div className="helper-text">
                {active.payloadKey === "prompt"
                  ? "Uses the full pipeline and returns a validated response."
                  : "Checks the prompt against this validator only."}
              </div>
              <button className="action-button" type="submit" disabled={isLoading}>
                {isLoading ? "Validating..." : "Run Validation"}
              </button>
            </div>
          </form>

          {response && (() => {
            const details =
              typeof response.details === "object" && response.details !== null
                ? (response.details as Record<string, unknown>)
                : null;
            const executionTime =
              response.execution_time ?? details?.execution_time ?? null;
            const statusValue =
              response.status ?? response.phase ?? "unknown";
            const statusText = String(statusValue).toLowerCase();
            const statusTone =
              statusText === "passed" || statusText === "success"
                ? "success"
                : statusText === "failed" || statusText === "error"
                ? "failed"
                : "note";
            const knownKeys = new Set([
              "status",
              "phase",
              "validator_failed",
              "execution_time",
              "output",
              "error",
              "validated_prompt",
              "validated_response",
              "details",
            ]);
            const extraEntries = Object.entries(response).filter(
              ([key]) => !knownKeys.has(key)
            );

            return (
              <div
                className={`response-card ${
                  response.status === "failed"
                    ? "failed"
                    : response.status === "not_configured"
                    ? "note"
                    : "success"
                }`}
              >
                <div className="response-header">
                  <div>
                    <h4>Response Summary</h4>
                    <p>Structured view of the validator output.</p>
                  </div>
                  <span className={`response-badge ${statusTone}`}>
                    {String(statusValue)}
                  </span>
                </div>

                <div className="response-table">
                  <div className={`response-row ${statusTone}`}>
                    <span>Status</span>
                    {formatValue(statusValue)}
                  </div>
                  {response.phase && (
                    <div className="response-row">
                      <span>Phase</span>
                      {formatValue(response.phase)}
                    </div>
                  )}
                  {response.validator_failed && (
                    <div className="response-row">
                      <span>Validator Failed</span>
                      {formatValue(response.validator_failed)}
                    </div>
                  )}
                  {executionTime !== null && (
                    <div className="response-row">
                      <span>Execution Time (s)</span>
                      {formatValue(executionTime)}
                    </div>
                  )}
                  {response.output && (
                    <div className="response-row">
                      <span>Output</span>
                      {formatValue(response.output)}
                    </div>
                  )}
                  {response.error && (
                    <div className="response-row">
                      <span>Error</span>
                      {formatValue(response.error)}
                    </div>
                  )}
                  {response.validated_prompt && (
                    <div className="response-row">
                      <span>Validated Prompt</span>
                      {formatValue(response.validated_prompt)}
                    </div>
                  )}
                  {response.validated_response && (
                    <div className="response-row">
                      <span>Validated Response</span>
                      {formatValue(response.validated_response)}
                    </div>
                  )}
                </div>

                {details && (
                  <div className="response-section">
                    <h5>Details</h5>
                    <div className="response-table compact">
                      {Object.entries(details).map(([key, value]) => (
                        <div key={key} className="response-row">
                          <span>{key}</span>
                          {formatValue(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extraEntries.length > 0 && (
                  <div className="response-section">
                    <h5>Additional Fields</h5>
                    <div className="response-table compact">
                      {extraEntries.map(([key, value]) => (
                        <div key={key} className="response-row">
                          <span>{key}</span>
                          {formatValue(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      </main>
    </div>
  );
}
