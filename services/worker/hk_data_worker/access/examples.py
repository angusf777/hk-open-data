from __future__ import annotations

import json
import shlex
from dataclasses import dataclass
from typing import Literal
from urllib.parse import quote, urlencode

from .models import AccessRecipe, HeaderSpec, JsonScalar

ExampleLanguage = Literal["curl", "python", "typescript"]


@dataclass(frozen=True)
class ExampleRequest:
    method: str
    url: str
    headers: tuple[HeaderSpec, ...]
    body: dict[str, object] | str | None
    timeout_ms: int


def _parameter_value(default: JsonScalar | None, example: JsonScalar | None) -> JsonScalar:
    value = default if default is not None else example
    if value is None:
        raise ValueError("example generation requires a default or safe example")
    return value


def example_request(recipe: AccessRecipe) -> ExampleRequest:
    request = recipe.request
    if request is None:
        raise ValueError(f"{recipe.source_reference} has no executable request")
    url = request.url_template
    query: list[tuple[str, str]] = []
    for parameter in request.parameters:
        value = _parameter_value(parameter.default, parameter.example)
        if parameter.location == "path":
            placeholder = "{" + parameter.name + "}"
            if placeholder not in url:
                raise ValueError(f"missing path placeholder for {parameter.name}")
            url = url.replace(placeholder, quote(str(value), safe=""))
        elif parameter.location == "query":
            rendered = str(value).lower() if isinstance(value, bool) else str(value)
            query.append((parameter.name, rendered))
    if query:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}{urlencode(query)}"
    return ExampleRequest(
        method=request.method,
        url=url,
        headers=request.headers,
        body=request.body_template,
        timeout_ms=request.timeout_ms,
    )


def _timeout_seconds(timeout_ms: int) -> str:
    seconds = timeout_ms / 1_000
    return str(int(seconds)) if seconds.is_integer() else str(seconds)


def _header_value(recipe: AccessRecipe, header: HeaderSpec, variable: str) -> str:
    if recipe.authentication.type == "bearer" and header.name.lower() == "authorization":
        return f"Bearer {variable}"
    return variable


def _curl_header(recipe: AccessRecipe, header: HeaderSpec) -> str:
    if header.value is not None:
        return shlex.quote(f"{header.name}: {header.value}")
    assert header.environment_variable is not None
    variable = "${" + header.environment_variable + "}"
    return '"' + f"{header.name}: {_header_value(recipe, header, variable)}" + '"'


def render_curl(recipe: AccessRecipe) -> str:
    request = example_request(recipe)
    argv = [
        "curl",
        "--fail-with-body",
        "--silent",
        "--show-error",
        "--max-time",
        _timeout_seconds(request.timeout_ms),
        "--request",
        request.method,
    ]
    rendered = [shlex.quote(value) for value in argv]
    for header in request.headers:
        rendered.extend(("--header", _curl_header(recipe, header)))
    if request.body is not None:
        body = (
            request.body
            if isinstance(request.body, str)
            else json.dumps(request.body, sort_keys=True)
        )
        rendered.extend(("--data", shlex.quote(body)))
    rendered.append(shlex.quote(request.url))
    separator = " \\" + "\n  "
    return separator.join(rendered) + "\n"


def _python_headers(recipe: AccessRecipe, headers: tuple[HeaderSpec, ...]) -> list[str]:
    values: list[str] = []
    for header in headers:
        if header.value is not None:
            value = repr(header.value)
        else:
            assert header.environment_variable is not None
            variable = f'os.environ["{header.environment_variable}"]'
            value = (
                f'f"Bearer {{{variable}}}"'
                if recipe.authentication.type == "bearer"
                and header.name.lower() == "authorization"
                else variable
            )
        values.append(f"    {header.name!r}: {value},")
    return values


def render_python(recipe: AccessRecipe) -> str:
    request = example_request(recipe)
    imports = ["import httpx"]
    if any(header.environment_variable for header in request.headers):
        imports.insert(0, "import os")
    lines = [*imports, "", f"url = {request.url!r}", "headers = {"]
    lines.extend(_python_headers(recipe, request.headers))
    lines.extend(
        [
            "}",
            "",
            "with httpx.Client("
            f"timeout={request.timeout_ms / 1_000!r}, follow_redirects=False"
            ") as client:",
            f"    response = client.request({request.method!r}, url, headers=headers"
            + (
                f", json={request.body!r})"
                if isinstance(request.body, dict)
                else f", content={request.body!r})"
                if isinstance(request.body, str)
                else ")"
            ),
            "    response.raise_for_status()",
            "    print(response.text)",
            "",
        ]
    )
    return "\n".join(lines)


def _typescript_headers(
    recipe: AccessRecipe, headers: tuple[HeaderSpec, ...]
) -> tuple[list[str], list[str]]:
    setup: list[str] = []
    values: list[str] = []
    for header in headers:
        if header.value is not None:
            value = json.dumps(header.value)
        else:
            assert header.environment_variable is not None
            identifier = f"env_{header.environment_variable.lower()}"
            setup.extend(
                [
                    f'const {identifier} = process.env["{header.environment_variable}"];',
                    f'if (!{identifier}) throw new Error("Missing {header.environment_variable}");',
                ]
            )
            value = (
                f'`Bearer ${{{identifier}}}`'
                if recipe.authentication.type == "bearer"
                and header.name.lower() == "authorization"
                else identifier
            )
        values.append(f"    {json.dumps(header.name)}: {value},")
    return setup, values


def render_typescript(recipe: AccessRecipe) -> str:
    request = example_request(recipe)
    setup, headers = _typescript_headers(recipe, request.headers)
    lines = [*setup]
    if setup:
        lines.append("")
    lines.extend(
        [
            f"const response = await fetch({json.dumps(request.url)}, {{",
            f"  method: {json.dumps(request.method)},",
            "  headers: {",
            *headers,
            "  },",
            f"  signal: AbortSignal.timeout({request.timeout_ms}),",
            '  redirect: "manual",',
        ]
    )
    if request.body is not None:
        body = (
            request.body
            if isinstance(request.body, str)
            else json.dumps(request.body, sort_keys=True)
        )
        lines.append(f"  body: {json.dumps(body)},")
    lines.extend(
        [
            "});",
            "",
            'if (!response.ok) throw new Error(`Provider request failed (${response.status})`);',
            "console.log(await response.text());",
            "",
        ]
    )
    return "\n".join(lines)


def render_example(recipe: AccessRecipe, language: ExampleLanguage) -> str:
    if language == "curl":
        return render_curl(recipe)
    if language == "python":
        return render_python(recipe)
    if language == "typescript":
        return render_typescript(recipe)
    raise ValueError(f"unsupported example language: {language}")
