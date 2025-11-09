"""
Article extraction using Jina Reader API
"""

import urllib.request
import urllib.error
from typing import Optional, Dict, Any
import json


JINA_READER_BASE = "https://r.jina.ai/"


def extract_article(url: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Extract article content using Jina Reader API

    Args:
        url: The URL to extract content from
        timeout: Request timeout in seconds

    Returns:
        Dictionary with 'title', 'content', 'url', 'success', and optional 'error'
    """
    jina_url = f"{JINA_READER_BASE}{url}"

    try:
        req = urllib.request.Request(
            jina_url,
            headers={
                "User-Agent": "NovusAmericanus/0.1.0",
                "Accept": "application/json"
            }
        )

        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status != 200:
                return {
                    "success": False,
                    "url": url,
                    "error": f"HTTP {response.status}"
                }

            content_type = response.headers.get("Content-Type", "")

            if "application/json" in content_type:
                data = json.loads(response.read().decode("utf-8"))
                return {
                    "success": True,
                    "url": url,
                    "title": data.get("data", {}).get("title", ""),
                    "content": data.get("data", {}).get("content", ""),
                    "raw_response": data
                }

            raw_content = response.read().decode("utf-8")
            title = _extract_title_from_markdown(raw_content)

            return {
                "success": True,
                "url": url,
                "title": title,
                "content": raw_content
            }

    except urllib.error.URLError as e:
        return {
            "success": False,
            "url": url,
            "error": f"URLError: {str(e)}"
        }
    except TimeoutError:
        return {
            "success": False,
            "url": url,
            "error": "Request timed out"
        }
    except Exception as e:
        return {
            "success": False,
            "url": url,
            "error": f"Unexpected error: {str(e)}"
        }


def _extract_title_from_markdown(markdown: str) -> str:
    """
    Extract title from markdown content (first H1 if present)
    """
    lines = markdown.split("\n")

    for line in lines:
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()

    return "Untitled"


def validate_url(url: str) -> bool:
    """
    Basic URL validation
    """
    if not url:
        return False

    url = url.strip()

    if not (url.startswith("http://") or url.startswith("https://")):
        return False

    return True
