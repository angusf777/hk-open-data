from __future__ import annotations

from collections.abc import Mapping


class SelectorError(ValueError):
    pass


def select_json_pointer(document: object, pointer: str) -> object:
    if pointer == "":
        return document
    if not pointer.startswith("/"):
        raise SelectorError("JSON pointer must be empty or start with '/'")
    current = document
    for encoded in pointer.removeprefix("/").split("/"):
        token = encoded.replace("~1", "/").replace("~0", "~")
        if isinstance(current, list):
            try:
                index = int(token)
                current = current[index]
            except (ValueError, IndexError) as error:
                raise SelectorError("JSON pointer array index is absent") from error
        elif isinstance(current, Mapping):
            if token not in current:
                raise SelectorError("JSON pointer field is absent")
            current = current[token]
        else:
            raise SelectorError("JSON pointer traverses a scalar")
    return current
