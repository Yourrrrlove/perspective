# DataFrame and Arrow Compatibility

`perspective-python` accepts a `Table` constructor argument from any of the
common Python columnar data libraries. In all three cases, `perspective.table`
(and `Table.update()`) consume the input directly — there is no need to
serialize to Apache Arrow IPC bytes yourself. However, note is
still the most efficient way to bulk load data into `Table`.

## PyArrow

```python
import pyarrow as pa
import perspective

arrow_table = pa.table({
    "int": pa.array([1, 2, 3], type=pa.int64()),
    "float": pa.array([1.5, 2.5, 3.5], type=pa.float64()),
    "string": pa.array(["a", "b", "c"], type=pa.string()),
})

table = perspective.table(arrow_table)
```

The same applies to `Table.update()`:

```python
table.update(arrow_table)
```

If you have Arrow data already in IPC format (e.g. read from disk, received
over the wire, or produced by another tool), pass the raw `bytes` directly —
both stream and file formats are auto-detected:

```python
with open("data.arrow", "rb") as f:
    table = perspective.table(f.read())
```

## Polars

```python
import polars as pl
import perspective

df = pl.DataFrame({
    "a": [1, 2, 3, 4, 5],
    "b": ["x", "y", "z", "x", "y"],
})

table = perspective.table(df)
```

Internally, the `DataFrame` is converted to a `pyarrow.Table` before
ingestion, so Polars columns inherit the Arrow type mapping above.

See also Perspective [Virtual Server support for `polars.DataFrame`](./virtual_server/polars.md)

## Pandas

`pandas.DataFrame` is supported via `pyarrow.Table.from_pandas`, which
dictates behavior including type support — see the
[pyarrow pandas docs](https://arrow.apache.org/docs/python/pandas.html) for
details on which pandas dtypes round-trip cleanly.

```python
from datetime import date, datetime
import numpy as np
import pandas as pd
import perspective

data = pd.DataFrame({
    "int": np.arange(100),
    "float": [i * 1.5 for i in range(100)],
    "bool": [True for i in range(100)],
    "date": [date.today() for i in range(100)],
    "datetime": [datetime.now() for i in range(100)],
    "string": [str(i) for i in range(100)],
})

table = perspective.table(data, index="float")
```
