#  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
#  ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
#  ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
#  ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
#  ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
#  ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
#  ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
#  ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
#  ┃ This file is part of the Perspective library, distributed under the terms ┃
#  ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
#  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import perspective as psp

client = psp.Server().new_local_client()


class TestJoin:
    def test_inner_join_two_tables(self):
        left = client.table(
            [{"id": 1, "x": 10}, {"id": 2, "x": 20}, {"id": 3, "x": 30}]
        )
        right = client.table(
            [{"id": 1, "y": "a"}, {"id": 2, "y": "b"}, {"id": 4, "y": "d"}]
        )
        joined = client.join(left, right, "id")
        view = joined.view()
        json = view.to_json()
        assert len(json) == 2
        view.delete()
        joined.delete()
        right.delete()
        left.delete()

    def test_join_has_correct_schema(self):
        left = client.table({"id": "integer", "x": "float"})
        right = client.table({"id": "integer", "y": "string"})
        joined = client.join(left, right, "id")
        schema = joined.schema()
        assert schema == {"id": "integer", "x": "float", "y": "string"}
        joined.delete()
        right.delete()
        left.delete()

    def test_join_reacts_to_left_updates(self):
        left = client.table(
            [{"id": 1, "x": 10}, {"id": 2, "x": 20}]
        )
        right = client.table(
            [{"id": 1, "y": "a"}, {"id": 2, "y": "b"}]
        )
        joined = client.join(left, right, "id")
        view = joined.view()
        left.update([{"id": 1, "x": 99}])
        json = view.to_json()
        assert json == [
            {"id": 1, "x": 10, "y": "a"},
            {"id": 2, "x": 20, "y": "b"},
            {"id": 1, "x": 99, "y": "a"},
        ]
        view.delete()
        joined.delete()
        right.delete()
        left.delete()

    def test_left_join(self):
        left = client.table(
            [{"id": 1, "x": 10}, {"id": 2, "x": 20}, {"id": 3, "x": 30}]
        )
        right = client.table(
            [{"id": 1, "y": "a"}, {"id": 2, "y": "b"}]
        )
        joined = client.join(left, right, "id", "left")
        view = joined.view()
        json = view.to_json()
        assert len(json) == 3
        view.delete()
        joined.delete()
        right.delete()
        left.delete()

    def test_join_by_table_names(self):
        left = client.table(
            [{"id": 1, "x": 10}, {"id": 2, "x": 20}],
            name="left_py",
        )
        right = client.table(
            [{"id": 1, "y": "a"}, {"id": 2, "y": "b"}],
            name="right_py",
        )
        joined = client.join("left_py", "right_py", "id")
        view = joined.view()
        json = view.to_json()
        assert len(json) == 2
        view.delete()
        joined.delete()
        right.delete()
        left.delete()

    def test_join_mixed_table_and_string(self):
        left = client.table(
            [{"id": 1, "x": 10}, {"id": 2, "x": 20}]
        )
        right = client.table(
            [{"id": 1, "y": "a"}, {"id": 2, "y": "b"}],
            name="right_py_mixed",
        )
        joined = client.join(left, "right_py_mixed", "id")
        view = joined.view()
        json = view.to_json()
        assert len(json) == 2
        view.delete()
        joined.delete()
        right.delete()
        left.delete()
