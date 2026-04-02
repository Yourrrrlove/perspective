# Joining Tables

`perspective.join()` creates a read-only `Table` by joining two source tables on
a shared key column. The result is reactive — it updates automatically when
either source table changes. See [`Join`](../../explanation/join.md) for
conceptual details.

## Basic Inner Join

```javascript
const orders = await perspective.table([
    { id: 1, product_id: 101, qty: 5 },
    { id: 2, product_id: 102, qty: 3 },
    { id: 3, product_id: 101, qty: 7 },
]);

const products = await perspective.table([
    { product_id: 101, name: "Widget" },
    { product_id: 102, name: "Gadget" },
]);

const joined = await perspective.join(orders, products, "product_id");
const view = await joined.view();
const json = await view.to_json();
// [
//   { product_id: 101, id: 1, qty: 5, name: "Widget" },
//   { product_id: 101, id: 3, qty: 7, name: "Widget" },
//   { product_id: 102, id: 2, qty: 3, name: "Gadget" },
// ]
```

## Join Types

Pass `join_type` in the options to select inner, left, or outer join behavior:

```javascript
// Left join: all left rows, nulls for unmatched right columns
const left_joined = await perspective.join(left, right, "id", {
    join_type: "left",
});

// Outer join: all rows from both tables
const outer_joined = await perspective.join(left, right, "id", {
    join_type: "outer",
});
```

## Reactive Updates

The joined table recomputes automatically when either source table is updated:

```javascript
const left = await perspective.table([{ id: 1, x: 10 }]);
const right = await perspective.table([{ id: 2, y: "b" }]);

const joined = await perspective.join(left, right, "id");
const view = await joined.view();

let json = await view.to_json();
// [] — no matching keys yet

await right.update([{ id: 1, y: "a" }]);
json = await view.to_json();
// [{ id: 1, x: 10, y: "a" }] — new match detected
```
