# Join

`Client::join` creates a read-only `Table` by joining two source tables on a
shared key column. The `left` and `right` arguments can be `Table` objects or
string table names (as returned by `get_hosted_table_names()`). The resulting
table is _reactive_: whenever either source table is updated, the join is
automatically recomputed and any `View` derived from the joined table will
update accordingly.

Joined tables support the full `View` API — you can apply `group_by`,
`split_by`, `sort`, `filter`, `expressions`, and all other `View` operations on
the result, just as you would with any other `Table`.
