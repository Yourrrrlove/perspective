# Joining Tables

`perspective.join()` creates a read-only `Table` by joining two source tables on
a shared key column. The result is reactive — it updates automatically when
either source table changes. See [`Join`](../../explanation/join.md) for
conceptual details.

## Basic Inner Join

```python
orders = perspective.table([
    {"id": 1, "product_id": 101, "qty": 5},
    {"id": 2, "product_id": 102, "qty": 3},
    {"id": 3, "product_id": 101, "qty": 7},
])

products = perspective.table([
    {"product_id": 101, "name": "Widget"},
    {"product_id": 102, "name": "Gadget"},
])

joined = perspective.join(orders, products, "product_id")
view = joined.view()
json = view.to_json()
```

## Join Types

Pass `join_type` to select inner, left, or outer join behavior:

```python
# Left join: all left rows, nulls for unmatched right columns
left_joined = perspective.join(left, right, "id", join_type="left")

# Outer join: all rows from both tables
outer_joined = perspective.join(left, right, "id", join_type="outer")
```

## Reactive Updates

The joined table recomputes automatically when either source table is updated:

```python
left = perspective.table([{"id": 1, "x": 10}])
right = perspective.table([{"id": 2, "y": "b"}])

joined = perspective.join(left, right, "id")
view = joined.view()

json = view.to_json()
# [] — no matching keys yet

right.update([{"id": 1, "y": "a"}])
json = view.to_json()
# [{"id": 1, "x": 10, "y": "a"}] — new match detected
```

## Async Client

The async client has the same API:

```python
joined = await client.join(orders, products, "product_id", join_type="left")
```
