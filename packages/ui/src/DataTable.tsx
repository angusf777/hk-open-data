import type { ReactNode } from "react";

export interface DataColumn<Row> {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  align?: "start" | "end" | undefined;
}

export interface DataTableProps<Row> {
  caption: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
}

export function DataTable<Row>({ caption, columns, rows, rowKey, empty }: DataTableProps<Row>) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align ?? "start"}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label} data-align={column.align ?? "start"}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="ui-table__empty" colSpan={columns.length}>
                {empty ?? "No data yet"}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
