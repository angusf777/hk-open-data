export function DeveloperPage() {
  return (
    <main className="public-main public-subpage developer-page">
      <p className="public-eyebrow">BUILD WITH THE LOCAL TOOLKIT</p>
      <h1>Developer access</h1>
      <p>
        Use data in your self-hosted toolkit through REST, TypeScript, Python, optional signed
        webhooks, or the included read-only MCP server.
      </p>
      <aside className="developer-callout">
        <strong>Local runtime only</strong>
        <span>
          This project does not operate a hosted API or MCP endpoint. Enable only the sources and
          access permissions your deployment needs.
        </span>
      </aside>
      <h2>REST example</h2>
      <pre>
        <code>{`curl -H "Authorization: Bearer $TOKEN" \\
  "http://127.0.0.1:3000/v1/source-records?source_id=HKAPI-001&limit=20"`}</code>
      </pre>
      <h2>Traceable results</h2>
      <p>
        Responses include source identifiers, observation and publication times, freshness, origin,
        and known limitations. Complete source responses are unavailable unless you turn on data
        access and storage for that source after reviewing its terms.
      </p>
      <h2>MCP</h2>
      <pre>
        <code>{`pnpm dlx @modelcontextprotocol/inspector --cli node dist/stdio.js \\
  -e PLATFORM_API_URL=http://127.0.0.1:3000/v1 --method tools/list --strict`}</code>
      </pre>
    </main>
  );
}
