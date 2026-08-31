import type { QueryResult, QueryResultRow } from "pg";

export interface PostgresClient {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
  release(): void;
}

export interface PostgresPool {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
  connect(): Promise<PostgresClient>;
  end(): Promise<void>;
}
