# Join Options

## `on` — Join Key Column

The `on` parameter specifies the column name used to match rows between the left
and right tables. This column must exist in the left table and, by default, must
also exist in the right table with the same name and compatible type.

The join key column becomes the index of the resulting table.

## `right_on` — Different Right Key Column

When the join key has a different name in the right table, use `right_on` to
specify the right table's column name. The left table's column name (`on`) is
used in the output schema; the right key column is excluded from the result.

The `on` and `right_on` columns must have compatible types. An error is thrown
if the types do not match.

## `join_type` — Join Type

Controls which rows are included in the result. See
[Join Types](./join_types.md) for details.

| Value       | Behavior                                              |
| ----------- | ----------------------------------------------------- |
| `"inner"`   | Only rows with matching keys in both tables (default) |
| `"left"`    | All left rows; unmatched right columns are `null`     |
| `"outer"`   | All rows from both tables; unmatched columns are `null` |

## `name` — Table Name

An optional name for the resulting joined table. If omitted, a random name is
generated. This name is used to identify the table in the server's hosted table
registry.
