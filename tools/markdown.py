"""
Markdown file helpers for essay management
"""

from pathlib import Path
from typing import Optional, List
from datetime import datetime


ESSAYS_DIR = Path(__file__).parent.parent / "essays"


def get_essay_path(essay_slug: str) -> Path:
    """
    Get the directory path for an essay
    """
    return ESSAYS_DIR / essay_slug


def ensure_essay_directory(essay_slug: str) -> Path:
    """
    Create essay directory if it doesn't exist

    Returns:
        Path to the essay directory
    """
    essay_path = get_essay_path(essay_slug)
    essay_path.mkdir(parents=True, exist_ok=True)

    sections_path = essay_path / "sections"
    sections_path.mkdir(exist_ok=True)

    return essay_path


def save_outline(essay_slug: str, outline_content: str) -> Path:
    """
    Save outline to essay directory

    Returns:
        Path to the saved outline file
    """
    essay_path = ensure_essay_directory(essay_slug)
    outline_path = essay_path / "outline.md"

    outline_path.write_text(outline_content)

    return outline_path


def get_outline(essay_slug: str) -> Optional[str]:
    """
    Read outline for an essay

    Returns:
        Outline content or None if not found
    """
    outline_path = get_essay_path(essay_slug) / "outline.md"

    if not outline_path.exists():
        return None

    return outline_path.read_text()


def save_section(essay_slug: str, section_name: str, content: str) -> Path:
    """
    Save a section to the essay directory

    Returns:
        Path to the saved section file
    """
    essay_path = ensure_essay_directory(essay_slug)
    sections_path = essay_path / "sections"

    section_filename = f"{_slugify(section_name)}.md"
    section_path = sections_path / section_filename

    section_path.write_text(content)

    return section_path


def get_section(essay_slug: str, section_name: str) -> Optional[str]:
    """
    Read a specific section

    Returns:
        Section content or None if not found
    """
    section_filename = f"{_slugify(section_name)}.md"
    section_path = get_essay_path(essay_slug) / "sections" / section_filename

    if not section_path.exists():
        return None

    return section_path.read_text()


def list_sections(essay_slug: str) -> List[str]:
    """
    List all section files for an essay

    Returns:
        List of section filenames (without .md extension)
    """
    sections_path = get_essay_path(essay_slug) / "sections"

    if not sections_path.exists():
        return []

    section_files = [
        f.stem for f in sections_path.glob("*.md")
        if f.is_file()
    ]

    return sorted(section_files)


def _slugify(text: str) -> str:
    """
    Convert text to a filename-safe slug
    """
    slug = text.lower()
    slug = slug.replace(" ", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    slug = "-".join(filter(None, slug.split("-")))

    return slug


def create_metadata_file(essay_slug: str, title: str, created_at: str) -> Path:
    """
    Create a metadata file for the essay

    Returns:
        Path to the metadata file
    """
    essay_path = ensure_essay_directory(essay_slug)
    metadata_path = essay_path / "metadata.md"

    metadata_content = f"""# {title}

**Created**: {created_at}
**Status**: In Progress

## Overview

[Essay description and notes]

## Research Notes

[Key findings and insights]
"""

    metadata_path.write_text(metadata_content)

    return metadata_path
