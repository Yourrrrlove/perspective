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

export const STD_DATE = new Date();

export const int_float_string_data = [
    { int: 1, float: 2.25, string: "a", datetime: STD_DATE },
    { int: 2, float: 3.5, string: "b", datetime: STD_DATE },
    { int: 3, float: 4.75, string: "c", datetime: STD_DATE },
    { int: 4, float: 5.25, string: "d", datetime: STD_DATE },
];

export const pivoted_output = [
    {
        __ROW_PATH__: [],
        int: 10,
        float: 15.75,
        string: 4,
        datetime: 4,
        __INDEX__: [3, 2, 1, 0],
    },
    {
        __ROW_PATH__: [1],
        int: 1,
        float: 2.25,
        string: 1,
        datetime: 1,
        __INDEX__: [0],
    },
    {
        __ROW_PATH__: [2],
        int: 2,
        float: 3.5,
        string: 1,
        datetime: 1,
        __INDEX__: [1],
    },
    {
        __ROW_PATH__: [3],
        int: 3,
        float: 4.75,
        string: 1,
        datetime: 1,
        __INDEX__: [2],
    },
    {
        __ROW_PATH__: [4],
        int: 4,
        float: 5.25,
        string: 1,
        datetime: 1,
        __INDEX__: [3],
    },
];
