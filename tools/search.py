"""
Web search functionality
"""

from typing import List, Dict, Any


def search_web(query: str, num_results: int = 10) -> List[Dict[str, Any]]:
    """
    Perform a web search and return results

    Note: This is a placeholder. Agents should use their built-in WebSearch tool
    or other available search capabilities. This function is provided for
    potential future integrations.

    Args:
        query: Search query string
        num_results: Number of results to return

    Returns:
        List of search results with 'url', 'title', 'snippet'
    """
    raise NotImplementedError(
        "Agents should use their built-in WebSearch tool directly. "
        "This module is reserved for future custom search integrations."
    )


def extract_urls_from_search_results(results: List[Dict[str, Any]]) -> List[str]:
    """
    Extract URLs from search results

    Args:
        results: List of search result dictionaries

    Returns:
        List of URLs
    """
    urls = []

    for result in results:
        if "url" in result:
            urls.append(result["url"])

    return urls
