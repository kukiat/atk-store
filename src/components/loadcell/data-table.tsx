import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  return (
    <div className="card-panel">
      <div className="data-table-wrap">
        <table className="data-table">
          <thead className="data-table-head">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cn("data-table-th", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="data-table-cell py-10 text-center text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i} className="data-table-row">
                  {columns.map((col) => (
                    <td key={col.key} className={cn("data-table-cell", col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const toneClass = {
  default: "badge-pill badge-pill--info",
  success: "badge-pill badge-pill--success",
  warning: "badge-pill badge-pill--warning",
  danger: "badge-pill badge-pill--danger",
  muted: "badge-pill badge-pill--muted",
} as const;

export function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: keyof typeof toneClass;
}) {
  return <span className={toneClass[tone]}>{label}</span>;
}
