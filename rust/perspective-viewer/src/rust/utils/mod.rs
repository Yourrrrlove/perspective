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

//! A catch all for project-wide macros and general-purpose functions that are
//! not directly related to Perspective.
//!
//! Modules below `crate::utils` strive to be single-responsibility, but some
//! reference other `crate::utils` modules when it helps reduce boiler-plate.

mod browser;
mod custom_element;
mod datetime;
mod debounce;
mod hooks;
mod modal_position;
mod number_format;
mod ptr_eq_rc;
mod pubsub;
mod weak_scope;

#[cfg(test)]
mod tests;

pub use browser::*;
pub use custom_element::*;
pub use datetime::*;
pub use debounce::*;
pub use hooks::*;
pub use modal_position::*;
pub use number_format::*;
pub use perspective_client::clone;
pub use ptr_eq_rc::*;
pub use pubsub::*;
pub use weak_scope::*;

/// An implementaiton of `try_blocks` feature in a non-nightly macro.
#[macro_export]
macro_rules! maybe {
    ($($exp:stmt);*) => {{
        let x = ({
            #[inline(always)]
            || {
                $($exp)*
            }
        })();
        x
    }};
}

/// As `maybe!`, but returns `()` and just logs errors.
#[macro_export]
macro_rules! maybe_log {
    ($($exp:tt)+) => {{
        let x = ({
            #[inline(always)]
            || {
                {
                    $($exp)+
                };
                Ok(())
            }
        })();
        x.unwrap_or_else(|e| web_sys::console::warn_1(&e))
    }};
}

#[macro_export]
macro_rules! maybe_log_or_default {
    ($($exp:tt)+) => {{
        let x = ({
            #[inline(always)]
            || {
                $($exp)+
            }
        })();
        x.unwrap_or_else(|e| {
            web_sys::console::warn_1(&e);
            Default::default()
        })
    }};
}

#[macro_export]
macro_rules! maybe_or_default {
    ($($exp:tt)+) => {{
        let x = ({
            #[inline(always)]
            || {
                $($exp)+
            }
        })();
        x.unwrap_or_else(|| {
            web_sys::console::warn_1("Unwrap on Noner");
            Default::default()
        })
    }};
}
