# Reactivity and Constraints

## Reactive Updates

Joined tables are fully reactive. When either source table receives an
`update()`, the join is automatically recomputed and any `View` created from the
joined table will reflect the new data. This includes:

- Updates that modify existing rows in either source table.
- New rows added to either source table that create new matches.
- Chained joins — if a joined table is itself used as input to another join,
  updates propagate through the entire chain.

## Duplicate Keys

Like SQL, `join()` produces a cross-product for each matching key value. When
multiple rows in the left table share the same key, each is paired with every
matching row in the right table (and vice versa). The number of output rows for
a given key is `left_count × right_count`.

This behavior depends on whether the source tables are _indexed_:

- **Unindexed tables** (no `index` option) — rows are appended, so duplicate
  keys accumulate naturally. Each `update()` appends new rows, which may
  introduce additional duplicates.
- **Indexed tables** (`index` set to the join key) — each key appears at most
  once per table, so the join produces at most one row per key. Updates replace
  existing rows in-place rather than appending.

## Read-Only

Joined tables are read-only. Calling `update()`, `remove()`, `clear()`, or
`replace()` on a joined table will throw an error. Data can only change
indirectly, by updating the source tables.

## Column Name Conflicts

The left and right tables must not have overlapping column names (other than the
join key). If a non-key column name appears in both tables, `join()` throws an
error. Rename columns in your source data or use `View` expressions to avoid
conflicts.

## Source Table Deletion

A source table cannot be deleted while a joined table depends on it. You must
delete the joined table first, then delete the source tables.
