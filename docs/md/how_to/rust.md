# Rust

Install via `cargo`:

```bash
cargo add perspective
```

# Example

Initialize a server and client

```rust
let server = Server::default();
let client = server.new_local_client();
```

Load an Arrow

```rust
let mut file = File::open(std::path::Path::new(ROOT_PATH).join(ARROW_FILE_PATH))?;
let mut feather = Vec::with_capacity(file.metadata()?.len() as usize);
file.read_to_end(&mut feather)?;
let data = UpdateData::Arrow(feather.into());
let mut options = TableInitOptions::default();
options.set_name("my_data_source");
client.table(data.into(), options).await?;
```

# Joining Tables

`Client::join` creates a read-only `Table` by joining two source tables on a
shared key column. The result is reactive — it updates automatically when
either source table changes. See [`Join`](../explanation/join.md) for
conceptual details.

```rust
let orders = client.table(
    TableData::Update(UpdateData::JsonRows(
        "[{\"id\":1,\"product_id\":101,\"qty\":5},{\"id\":2,\"product_id\":102,\"qty\":3}]".into(),
    )),
    TableInitOptions::default(),
).await?;

let products = client.table(
    TableData::Update(UpdateData::JsonRows(
        "[{\"product_id\":101,\"name\":\"Widget\"},{\"product_id\":102,\"name\":\"Gadget\"}]".into(),
    )),
    TableInitOptions::default(),
).await?;

let joined = client.join(
    (&orders).into(),
    (&products).into(),
    "product_id",
    JoinOptions::default(),
).await?;

let view = joined.view(None).await?;
let json = view.to_json().await?;
```

Use `JoinOptions` to configure the join type, table name, or `right_on` column:

```rust
let options = JoinOptions {
    join_type: Some(JoinType::Left),
    name: Some("orders_with_products".into()),
    right_on: None,
};

let joined = client.join(
    (&orders).into(),
    (&products).into(),
    "product_id",
    options,
).await?;
```

You can also join by table name strings instead of `Table` references:

```rust
let joined = client.join(
    "orders".into(),
    "products".into(),
    "product_id",
    JoinOptions::default(),
).await?;
```
