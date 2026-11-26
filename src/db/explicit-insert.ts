import { sql, type DriverValueEncoder, type SQL, type SQLWrapper } from 'drizzle-orm';

type NamedColumn = SQLWrapper & { readonly name: string };

export type ExplicitInsertBinding = {
  column: NamedColumn & DriverValueEncoder<any, any>;
  value: unknown;
};

export type ExplicitReturningColumn = {
  column: NamedColumn;
  alias: string;
};

export function tableReturningColumns(columns: Readonly<Record<string, NamedColumn>>): ExplicitReturningColumn[] {
  return Object.entries(columns).map(([alias, column]) => ({ alias, column }));
}

/** Build an INSERT from an explicit column allowlist so database defaults stay omitted. */
export function buildExplicitInsertQuery(
  table: SQLWrapper,
  bindings: readonly ExplicitInsertBinding[],
  returning: readonly ExplicitReturningColumn[] = [],
): SQL {
  return buildExplicitInsertManyQuery(table, [bindings], returning);
}

export function buildExplicitInsertManyQuery(
  table: SQLWrapper,
  rows: readonly (readonly ExplicitInsertBinding[])[],
  returning: readonly ExplicitReturningColumn[] = [],
): SQL {
  const firstRow = rows[0];
  if (!firstRow?.length) throw new Error('An explicit INSERT requires at least one row and column.');
  const columns = firstRow.map(({ column }) => column);
  if (new Set(columns).size !== columns.length) throw new Error('An explicit INSERT cannot repeat a column.');
  if (rows.some((row) => row.length !== columns.length || row.some((binding, index) => binding.column !== columns[index]))) {
    throw new Error('Every explicit INSERT row must use the same columns in the same order.');
  }
  if (returning.some(({ alias }) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias))) throw new Error('An explicit INSERT return alias is invalid.');

  const query = sql`insert into ${table} (`;
  query.append(sql.join(columns.map((column) => sql.identifier(column.name)), sql`, `));
  query.append(sql`) values `);
  rows.forEach((row, index) => {
    if (index > 0) query.append(sql`, `);
    query.append(sql`(`);
    query.append(sql.join(row.map(({ column, value }) => sql.param(value, column)), sql`, `));
    query.append(sql`)`);
  });
  if (returning.length > 0) {
    query.append(sql` returning `);
    query.append(sql.join(returning.map(({ column, alias }) => sql`${sql.identifier(column.name)} as ${sql.identifier(alias)}`), sql`, `));
  }
  return query;
}
