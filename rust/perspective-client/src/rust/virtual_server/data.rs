// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

use std::error::Error;
use std::sync::Arc;

use arrow::array::{
    Array, ArrayRef, BooleanArray, BooleanBuilder, Float64Array, Float64Builder, Int32Array,
    Int32Builder, RecordBatch, StringArray, StringBuilder, TimestampMillisecondArray,
    TimestampMillisecondBuilder,
};
use arrow::datatypes::{DataType, Field, Schema, TimeUnit};
use arrow::ipc::reader::StreamReader;
use arrow::ipc::writer::StreamWriter;
use indexmap::IndexMap;
use serde::Serialize;

use crate::config::{Scalar, ViewConfig};

/// An Arrow column builder, used during the population phase of
/// [`VirtualDataSlice`].
pub enum ColumnBuilder {
    Boolean(BooleanBuilder),
    String(StringBuilder),
    Float(Float64Builder),
    Integer(Int32Builder),
    Datetime(TimestampMillisecondBuilder),
}

/// A single cell value in a row-oriented data representation.
///
/// Used when converting [`VirtualDataSlice`] to row format for JSON
/// serialization.
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum VirtualDataCell {
    Boolean(Option<bool>),
    String(Option<String>),
    Float(Option<f64>),
    Integer(Option<i32>),
    Datetime(Option<i64>),
    RowPath(Vec<Scalar>),
}

/// Trait for types that can be written to a [`ColumnBuilder`] which
/// enforces sequential construction.
///
/// This trait enables type-safe insertion of values into virtual data columns,
/// ensuring that values are written to columns of the correct type.
pub trait SetVirtualDataColumn {
    /// Writes this value (sequentially) to the given column builder.
    ///
    /// Returns an error if the column type does not match the value type.
    fn write_to(self, col: &mut ColumnBuilder) -> Result<(), &'static str>;

    /// Creates a new empty column builder of the appropriate type for this
    /// value.
    fn new_builder() -> ColumnBuilder;

    /// Converts this value to a [`Scalar`] representation.
    fn to_scalar(self) -> Scalar;
}

impl SetVirtualDataColumn for Option<String> {
    fn write_to(self, col: &mut ColumnBuilder) -> Result<(), &'static str> {
        if let ColumnBuilder::String(builder) = col {
            match self {
                Some(s) => builder.append_value(&s),
                None => builder.append_null(),
            }
            Ok(())
        } else {
            Err("Bad type")
        }
    }

    fn new_builder() -> ColumnBuilder {
        ColumnBuilder::String(StringBuilder::new())
    }

    fn to_scalar(self) -> Scalar {
        if let Some(x) = self {
            Scalar::String(x)
        } else {
            Scalar::Null
        }
    }
}

impl SetVirtualDataColumn for Option<f64> {
    fn write_to(self, col: &mut ColumnBuilder) -> Result<(), &'static str> {
        if let ColumnBuilder::Float(builder) = col {
            match self {
                Some(v) => builder.append_value(v),
                None => builder.append_null(),
            }
            Ok(())
        } else {
            Err("Bad type")
        }
    }

    fn new_builder() -> ColumnBuilder {
        ColumnBuilder::Float(Float64Builder::new())
    }

    fn to_scalar(self) -> Scalar {
        if let Some(x) = self {
            Scalar::Float(x)
        } else {
            Scalar::Null
        }
    }
}

impl SetVirtualDataColumn for Option<i32> {
    fn write_to(self, col: &mut ColumnBuilder) -> Result<(), &'static str> {
        if let ColumnBuilder::Integer(builder) = col {
            match self {
                Some(v) => builder.append_value(v),
                None => builder.append_null(),
            }
            Ok(())
        } else {
            Err("Bad type")
        }
    }

    fn new_builder() -> ColumnBuilder {
        ColumnBuilder::Integer(Int32Builder::new())
    }

    fn to_scalar(self) -> Scalar {
        if let Some(x) = self {
            Scalar::Float(x as f64)
        } else {
            Scalar::Null
        }
    }
}

impl SetVirtualDataColumn for Option<i64> {
    fn write_to(self, col: &mut ColumnBuilder) -> Result<(), &'static str> {
        if let ColumnBuilder::Datetime(builder) = col {
            match self {
                Some(v) => builder.append_value(v),
                None => builder.append_null(),
            }
            Ok(())
        } else {
            Err("Bad type")
        }
    }

    fn new_builder() -> ColumnBuilder {
        ColumnBuilder::Datetime(TimestampMillisecondBuilder::new())
    }

    fn to_scalar(self) -> Scalar {
        if let Some(x) = self {
            Scalar::Float(x as f64)
        } else {
            Scalar::Null
        }
    }
}

impl SetVirtualDataColumn for Option<bool> {
    fn write_to(self, col: &mut ColumnBuilder) -> Result<(), &'static str> {
        if let ColumnBuilder::Boolean(builder) = col {
            match self {
                Some(v) => builder.append_value(v),
                None => builder.append_null(),
            }
            Ok(())
        } else {
            Err("Bad type")
        }
    }

    fn new_builder() -> ColumnBuilder {
        ColumnBuilder::Boolean(BooleanBuilder::new())
    }

    fn to_scalar(self) -> Scalar {
        if let Some(x) = self {
            Scalar::Bool(x)
        } else {
            Scalar::Null
        }
    }
}

/// A columnar data slice returned from a virtual server view query.
///
/// This struct represents a rectangular slice of data from a view, stored
/// internally as Arrow builders during population and frozen into a
/// `RecordBatch` on first consumption.
#[derive(Debug)]
pub struct VirtualDataSlice {
    config: ViewConfig,
    builders: IndexMap<String, ColumnBuilder>,
    row_path: Option<Vec<Vec<Scalar>>>,
    frozen: Option<RecordBatch>,
}

impl std::fmt::Debug for ColumnBuilder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ColumnBuilder::Boolean(_) => write!(f, "ColumnBuilder::Boolean(..)"),
            ColumnBuilder::String(_) => write!(f, "ColumnBuilder::String(..)"),
            ColumnBuilder::Float(_) => write!(f, "ColumnBuilder::Float(..)"),
            ColumnBuilder::Integer(_) => write!(f, "ColumnBuilder::Integer(..)"),
            ColumnBuilder::Datetime(_) => write!(f, "ColumnBuilder::Datetime(..)"),
        }
    }
}

impl VirtualDataSlice {
    pub fn new(config: ViewConfig) -> Self {
        VirtualDataSlice {
            config,
            builders: IndexMap::default(),
            row_path: None,
            frozen: None,
        }
    }

    /// Loads data from Arrow IPC streaming format bytes, replacing any
    /// existing builder state.
    ///
    /// This is an alternative to populating the slice cell-by-cell via
    /// [`set_col`]. The IPC stream should contain a single `RecordBatch`
    /// (only the first batch is used if multiple are present).
    pub fn from_arrow_ipc(&mut self, ipc: &[u8]) -> Result<(), Box<dyn Error>> {
        let cursor = std::io::Cursor::new(ipc);
        let mut reader = StreamReader::try_new(cursor, None)?;
        let batch = reader
            .next()
            .ok_or("Arrow IPC stream contained no record batches")??;

        self.frozen = Some(batch);
        Ok(())
    }

    /// Freezes the builders into a `RecordBatch`. Idempotent — subsequent
    /// calls return the cached batch.
    pub(crate) fn freeze(&mut self) -> &RecordBatch {
        if self.frozen.is_none() {
            let mut fields = Vec::new();
            let mut arrays: Vec<ArrayRef> = Vec::new();

            for (name, builder) in &mut self.builders {
                let (field, array): (Field, ArrayRef) = match builder {
                    ColumnBuilder::Boolean(b) => (
                        Field::new(name, DataType::Boolean, true),
                        Arc::new(b.finish()),
                    ),
                    ColumnBuilder::String(b) => {
                        (Field::new(name, DataType::Utf8, true), Arc::new(b.finish()))
                    },
                    ColumnBuilder::Float(b) => (
                        Field::new(name, DataType::Float64, true),
                        Arc::new(b.finish()),
                    ),
                    ColumnBuilder::Integer(b) => (
                        Field::new(name, DataType::Int32, true),
                        Arc::new(b.finish()),
                    ),
                    ColumnBuilder::Datetime(b) => (
                        Field::new(name, DataType::Timestamp(TimeUnit::Millisecond, None), true),
                        Arc::new(b.finish()),
                    ),
                };
                fields.push(field);
                arrays.push(array);
            }

            let schema = Arc::new(Schema::new(fields));
            self.frozen = Some(
                RecordBatch::try_new(schema, arrays)
                    .expect("RecordBatch construction should not fail for well-formed builders"),
            );
        }
        self.frozen.as_ref().unwrap()
    }

    /// Serializes the data to Arrow IPC streaming format.
    pub(crate) fn to_arrow_ipc(&mut self) -> Result<Vec<u8>, Box<dyn Error>> {
        let batch = self.freeze().clone();
        let schema = batch.schema();
        let mut buf = Vec::new();
        {
            let mut writer = StreamWriter::try_new(&mut buf, &schema)?;
            writer.write(&batch)?;
            writer.finish()?;
        }
        Ok(buf)
    }

    /// Converts the columnar data to a row-oriented representation for JSON
    /// serialization.
    pub(crate) fn to_rows(&mut self) -> Vec<IndexMap<String, VirtualDataCell>> {
        let batch = self.freeze().clone();
        let num_rows = batch.num_rows();
        let schema = batch.schema();

        (0..num_rows)
            .map(|row_idx| {
                let mut row = IndexMap::new();

                // Add RowPath column first if present
                if let Some(ref rp) = self.row_path
                    && row_idx < rp.len()
                {
                    row.insert(
                        "__ROW_PATH__".to_string(),
                        VirtualDataCell::RowPath(rp[row_idx].clone()),
                    );
                }

                // Add Arrow columns
                for (col_idx, field) in schema.fields().iter().enumerate() {
                    let col = batch.column(col_idx);
                    let cell = if col.is_null(row_idx) {
                        match field.data_type() {
                            DataType::Boolean => VirtualDataCell::Boolean(None),
                            DataType::Utf8 => VirtualDataCell::String(None),
                            DataType::Float64 => VirtualDataCell::Float(None),
                            DataType::Int32 => VirtualDataCell::Integer(None),
                            DataType::Timestamp(TimeUnit::Millisecond, _) => {
                                VirtualDataCell::Datetime(None)
                            },
                            _ => continue,
                        }
                    } else {
                        match field.data_type() {
                            DataType::Boolean => {
                                let arr = col.as_any().downcast_ref::<BooleanArray>().unwrap();
                                VirtualDataCell::Boolean(Some(arr.value(row_idx)))
                            },
                            DataType::Utf8 => {
                                let arr = col.as_any().downcast_ref::<StringArray>().unwrap();
                                VirtualDataCell::String(Some(arr.value(row_idx).to_string()))
                            },
                            DataType::Float64 => {
                                let arr = col.as_any().downcast_ref::<Float64Array>().unwrap();
                                VirtualDataCell::Float(Some(arr.value(row_idx)))
                            },
                            DataType::Int32 => {
                                let arr = col.as_any().downcast_ref::<Int32Array>().unwrap();
                                VirtualDataCell::Integer(Some(arr.value(row_idx)))
                            },
                            DataType::Timestamp(TimeUnit::Millisecond, _) => {
                                let arr = col
                                    .as_any()
                                    .downcast_ref::<TimestampMillisecondArray>()
                                    .unwrap();
                                VirtualDataCell::Datetime(Some(arr.value(row_idx)))
                            },
                            _ => continue,
                        }
                    };
                    row.insert(field.name().clone(), cell);
                }

                row
            })
            .collect()
    }

    /// Serializes the data to a column-oriented JSON string.
    pub(crate) fn to_columns_json(&mut self) -> Result<String, Box<dyn Error>> {
        let batch = self.freeze().clone();
        let schema = batch.schema();
        let mut map = serde_json::Map::new();

        // Add RowPath if present
        if let Some(ref rp) = self.row_path {
            map.insert("__ROW_PATH__".to_string(), serde_json::to_value(rp)?);
        }

        for (col_idx, field) in schema.fields().iter().enumerate() {
            let col = batch.column(col_idx);
            let num_rows = col.len();
            let values: serde_json::Value = match field.data_type() {
                DataType::Boolean => {
                    let arr = col.as_any().downcast_ref::<BooleanArray>().unwrap();
                    serde_json::to_value(
                        (0..num_rows)
                            .map(|i| {
                                if arr.is_null(i) {
                                    None
                                } else {
                                    Some(arr.value(i))
                                }
                            })
                            .collect::<Vec<_>>(),
                    )?
                },
                DataType::Utf8 => {
                    let arr = col.as_any().downcast_ref::<StringArray>().unwrap();
                    serde_json::to_value(
                        (0..num_rows)
                            .map(|i| {
                                if arr.is_null(i) {
                                    None
                                } else {
                                    Some(arr.value(i))
                                }
                            })
                            .collect::<Vec<_>>(),
                    )?
                },
                DataType::Float64 => {
                    let arr = col.as_any().downcast_ref::<Float64Array>().unwrap();
                    serde_json::to_value(
                        (0..num_rows)
                            .map(|i| {
                                if arr.is_null(i) {
                                    None
                                } else {
                                    Some(arr.value(i))
                                }
                            })
                            .collect::<Vec<_>>(),
                    )?
                },
                DataType::Int32 => {
                    let arr = col.as_any().downcast_ref::<Int32Array>().unwrap();
                    serde_json::to_value(
                        (0..num_rows)
                            .map(|i| {
                                if arr.is_null(i) {
                                    None
                                } else {
                                    Some(arr.value(i))
                                }
                            })
                            .collect::<Vec<_>>(),
                    )?
                },
                DataType::Timestamp(TimeUnit::Millisecond, _) => {
                    let arr = col
                        .as_any()
                        .downcast_ref::<TimestampMillisecondArray>()
                        .unwrap();
                    serde_json::to_value(
                        (0..num_rows)
                            .map(|i| {
                                if arr.is_null(i) {
                                    None
                                } else {
                                    Some(arr.value(i))
                                }
                            })
                            .collect::<Vec<_>>(),
                    )?
                },
                _ => continue,
            };
            map.insert(field.name().clone(), values);
        }

        Ok(serde_json::to_string(&map)?)
    }

    /// Sets a value in a column at the specified row index.
    ///
    /// If `group_by_index` is `Some`, the value is added to the `__ROW_PATH__`
    /// column as part of the row's group-by path. Otherwise, the value is
    /// inserted into the named column.
    ///
    /// Creates the column if it does not already exist.
    pub fn set_col<T: SetVirtualDataColumn>(
        &mut self,
        name: &str,
        grouping_id: Option<usize>,
        index: usize,
        value: T,
    ) -> Result<(), Box<dyn Error>> {
        if name.starts_with("__ROW_PATH_") {
            let group_by_index: u32 = name[11..name.len() - 2].parse()?;
            let max_grouping_id =
                2_i32.pow((self.config.group_by.len() as u32) - group_by_index) - 1;

            if grouping_id.map(|x| x as i32).unwrap_or(i32::MAX) < max_grouping_id {
                let col = self.row_path.get_or_insert_with(Vec::new);
                if let Some(row) = col.get_mut(index) {
                    let scalar = value.to_scalar();
                    row.push(scalar);
                } else {
                    while col.len() < index {
                        col.push(vec![])
                    }

                    let scalar = value.to_scalar();
                    col.push(vec![scalar]);
                }
            }

            Ok(())
        } else {
            if !self.builders.contains_key(name) {
                self.builders.insert(name.to_owned(), T::new_builder());
            }

            let col = self
                .builders
                .get_mut(name)
                .ok_or_else(|| format!("Column '{}' not found after insertion", name))?;

            Ok(value.write_to(col)?)
        }
    }
}
