# Join Types

`Client::join` supports three join types, specified via the `join_type` option.
The default is `"inner"`.

## Inner Join (default)

An inner join includes only rows where the key column exists in _both_ source
tables. Rows from either table that have no match in the other are excluded.

## Left Join

A left join includes all rows from the left table. For left rows that have no
match in the right table, right-side columns are filled with `null`.

## Outer Join

An outer join includes all rows from both tables. Unmatched rows on either side
have their missing columns filled with `null`.

| `join_type` | Left-only rows | Right-only rows |
| ----------- | -------------- | --------------- |
| `"inner"`   | excluded       | excluded        |
| `"left"`    | included       | excluded        |
| `"outer"`   | included       | included        |
