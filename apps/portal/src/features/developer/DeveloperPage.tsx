export function DeveloperPage() {
  return (
    <main className="public-main public-subpage developer-page">
      <p className="public-eyebrow">BUILD ON LOCAL EVIDENCE</p>
      <h1>Developer access</h1>
      <p>
        Use your self-hosted read model through REST, TypeScript, Python, optional signed webhooks,
        or the project-provided read-only MCP server.
      </p>
      <aside className="developer-callout">
        <strong>Local runtime only</strong>
        <span>
          The project does not operate a hosted API or MCP endpoint. Configure only the scopes and
          sources your deployment needs.
        </span>
      </aside>
      <h2>REST example</h2>
      <pre>
        <code>{`curl -H "Authorization: Bearer $TOKEN" \\
  "http://127.0.0.1:3000/v1/source-records?source_id=HKAPI-001&limit=20"`}</code>
      </pre>
      <h2>Evidence contract</h2>
      <p>
        Responses retain source-record identifiers, observed and publication times, freshness,
        provenance, and explicit limitations. Raw payload access is disabled unless the operator
        explicitly enables the fabric profile and records source-specific approval.
      </p>
      <h2>MCP</h2>
      <pre>
        <code>{`pnpm dlx @modelcontextprotocol/inspector --cli node dist/stdio.js \\
  -e PLATFORM_API_URL=http://127.0.0.1:3000/v1 --method tools/list --strict`}</code>
      </pre>
    </main>
  );
}
