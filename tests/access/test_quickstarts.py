from pathlib import Path

from scripts.quickstarts import QUICKSTARTS, check_documents, render_documents


def test_quickstarts_are_generated_from_current_success_evidence() -> None:
    documents = render_documents()

    assert len(QUICKSTARTS) == 5
    assert set(documents) == {"README.md", *(f"{item.slug}.md" for item in QUICKSTARTS)}
    for item in QUICKSTARTS:
        document = documents[f"{item.slug}.md"]
        assert item.source_reference in document
        assert "## What was verified" in document
        assert "does not grant rights" in document


def test_committed_quickstarts_have_no_generation_drift() -> None:
    assert Path("docs/quickstarts/README.md").exists()
    check_documents()
