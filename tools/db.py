"""
Database operations for article storage and retrieval
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any


DB_PATH = Path(__file__).parent.parent / "knowledge" / "articles.db"


def init_db() -> None:
    """
    Initialize the database with required tables
    """
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            title TEXT,
            content TEXT,
            source_date TEXT,
            archived_at TEXT NOT NULL,
            essay_slug TEXT NOT NULL,
            query TEXT,
            metadata TEXT
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_essay_slug
        ON articles(essay_slug)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_url
        ON articles(url)
    """)

    conn.commit()
    conn.close()


def store_article(
    url: str,
    essay_slug: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    source_date: Optional[str] = None,
    query: Optional[str] = None,
    metadata: Optional[str] = None
) -> int:
    """
    Store an article in the database

    Returns:
        article_id: The ID of the stored article
    """
    init_db()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    archived_at = datetime.utcnow().isoformat()

    try:
        cursor.execute("""
            INSERT INTO articles
            (url, title, content, source_date, archived_at, essay_slug, query, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (url, title, content, source_date, archived_at, essay_slug, query, metadata))

        article_id = cursor.lastrowid
        conn.commit()

    except sqlite3.IntegrityError:
        cursor.execute("SELECT id FROM articles WHERE url = ?", (url,))
        article_id = cursor.fetchone()[0]

    finally:
        conn.close()

    return article_id


def get_articles_for_essay(essay_slug: str) -> List[Dict[str, Any]]:
    """
    Retrieve all articles for a given essay
    """
    init_db()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM articles
        WHERE essay_slug = ?
        ORDER BY archived_at DESC
    """, (essay_slug,))

    articles = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return articles


def get_article_by_url(url: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a specific article by URL
    """
    init_db()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM articles WHERE url = ?", (url,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)

    return None


def count_articles_for_essay(essay_slug: str) -> int:
    """
    Count articles for a specific essay
    """
    init_db()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) FROM articles WHERE essay_slug = ?
    """, (essay_slug,))

    count = cursor.fetchone()[0]
    conn.close()

    return count
