from __future__ import annotations

import ast
import subprocess
from pathlib import Path

from hk_data_worker.access.examples import render_example
from hk_data_worker.access.registry import load_recipes

FIXTURES = Path(__file__).parent / "fixtures"
EXPECTED_URL = (
    "https://data.gov.hk/en-data/api/3/action/package_list?limit=10&offset=0"
)


def test_curl_example_is_shell_safe_and_uses_bounded_defaults() -> None:
    recipe = load_recipes(FIXTURES / "valid")[0]

    example = render_example(recipe, "curl")

    assert example == (
        "curl \\\n"
        "  --fail-with-body \\\n"
        "  --silent \\\n"
        "  --show-error \\\n"
        "  --max-time \\\n"
        "  15 \\\n"
        "  --request \\\n"
        "  GET \\\n"
        "  --header \\\n"
        "  'accept: application/json' \\\n"
        f"  '{EXPECTED_URL}'\n"
    )
    subprocess.run(["bash", "-n"], input=example, text=True, check=True)


def test_python_and_typescript_examples_parse_and_use_the_same_url(tmp_path: Path) -> None:
    recipe = load_recipes(FIXTURES / "valid")[0]

    python_example = render_example(recipe, "python")
    typescript_example = render_example(recipe, "typescript")

    ast.parse(python_example)
    assert EXPECTED_URL in python_example
    assert EXPECTED_URL in typescript_example
    script = tmp_path / "example.mjs"
    script.write_text(typescript_example, encoding="utf-8")
    subprocess.run(["node", "--check", str(script)], check=True)


def test_resource_index_examples_point_to_the_underlying_resource_urls(
    tmp_path: Path,
) -> None:
    recipe = load_recipes(FIXTURES / "valid")[0].model_copy(
        update={"adapter": "data-gov-resource-index"}
    )

    curl_example = render_example(recipe, "curl")
    python_example = render_example(recipe, "python")
    typescript_example = render_example(recipe, "typescript")

    assert ".result.resources" in curl_example
    assert 'resource.get("url", "")' in python_example
    assert "dataset.resources" in typescript_example
    ast.parse(python_example)
    script = tmp_path / "resource-index.mjs"
    script.write_text(typescript_example, encoding="utf-8")
    subprocess.run(["node", "--check", str(script)], check=True)
