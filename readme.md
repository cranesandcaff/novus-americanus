# Novus Americanus

A system for writing deeply researched, long-form political essays using AI agents in Claude Code.

## Vision

Write Curtis Yarvin-style longform political essays but for the Left and with your authentic voice. Use AI to handle research, analysis, and first-draft writing while you guide and edit.

## Implementation: Claude Code + Agents

After evaluating Notion + Claude App, custom Tauri apps, and other options, we've built a **Claude Code agent system** with:

- **Ra** (Research Agent): Searches web, extracts articles, stores in SQLite
- **Oa** (Outline Agent): Creates structured outlines from research
- **Ja** (Journalist Agent): Writes essay sections one at a time
- **Ea** (Editor Agent): Reviews and provides feedback

This approach gives us:
- Flexibility to use any database (SQLite for now, can evolve)
- Direct file system access for markdown files
- No context limits - agents work on one section at a time
- Simple Python tools that agents orchestrate
- Easy to extend and customize

## Quick Start

### Installation

```bash
pip install -r requirements.txt
```

### Usage Example

Start researching a new essay:

```bash
@ra research "solving police violence through malpractice insurance"
```

Ra will:
1. Create essay slug: `police-malpractice-insurance`
2. Initialize working.toml with essay metadata
3. Search web for relevant articles
4. Extract content using Jina Reader API
5. Store in SQLite database
6. Report findings and suggest follow-up searches

Continue with outline (coming soon):

```bash
@oa create outline
```

Write sections (coming soon):

```bash
@ja write section "Introduction"
```

Get feedback (coming soon):

```bash
@ea review section "Introduction"
```

## Architecture

```
novus-americanus/
├── .claude/
│   └── agents/          # Agent instruction files
│       ├── ra.md        # Research Agent
│       ├── oa.md        # Outline Agent
│       ├── ja.md        # Journalist Agent
│       └── ea.md        # Editor Agent
├── tools/               # Python utilities agents call
│   ├── db.py           # SQLite operations
│   ├── jina.py         # Jina Reader API integration
│   ├── markdown.py     # Essay file management
│   └── search.py       # Search utilities
├── knowledge/
│   ├── articles.db     # SQLite with research
│   └── archives/       # Archived PDFs (future)
├── essays/             # Generated essays
│   └── [slug]/
│       ├── outline.md
│       └── sections/
└── working.toml        # Current essay context
```

## How It Works

### 1. Research Phase (Ra - Ready Now!)

Example: `@ra research "police malpractice insurance"`

Ra performs:
- Creates essay slug from topic
- Updates working.toml with new essay
- Uses WebSearch to find articles
- Extracts content via Jina Reader: `https://r.jina.ai/[url]`
- Stores articles in SQLite with metadata
- Reports: "Found 15 articles, archived 10 successfully"
- Suggests follow-up searches

### 2. Outline Phase (Oa - Coming Soon)

Example: `@oa create outline`

Oa will:
- Read working.toml to get current essay
- Query all research articles from database
- Synthesize themes and structure
- Generate hierarchical outline
- Save to `essays/[slug]/outline.md`
- Update working.toml status

### 3. Writing Phase (Ja - Coming Soon)

Example: `@ja write section "Introduction"`

Ja will:
- Read outline.md for context
- Query relevant research for this section
- Write 1,000-2,000 word section
- Cite sources appropriately
- Save to `essays/[slug]/sections/introduction.md`
- Update working.toml word count

### 4. Editing Phase (Ea - Coming Soon)

Example: `@ea review section "Introduction"`

Ea will:
- Read completed section
- Check clarity, flow, accuracy
- Verify citations
- Provide specific feedback
- Suggest revisions

## Working Context (working.toml)

Agents coordinate through working.toml:

```toml
[current_essay]
slug = "police-malpractice-insurance"
title = "Solving Police Violence Through Malpractice Insurance"
status = "researching"  # researching, outlining, writing, editing, published
created_at = "2025-11-09T14:32:00Z"
last_updated = "2025-11-09T16:45:00Z"

[research]
last_query = "police malpractice insurance reform"
articles_found = 15
articles_archived = 10

[outline]
sections_planned = 0
sections_written = 0

[writing]
words_written = 0
target_words = 5000
```

## Tools for Agents

### Database (tools/db.py)

Simple SQLite schema:

```python
from tools.db import store_article, get_articles_for_essay

article_id = store_article(
    url="https://example.com/article",
    essay_slug="police-malpractice-insurance",
    title="Article Title",
    content="Full markdown content...",
    query="police malpractice insurance"
)

articles = get_articles_for_essay("police-malpractice-insurance")
```

### Jina Reader (tools/jina.py)

Extract clean content from any URL:

```python
from tools.jina import extract_article

result = extract_article("https://nytimes.com/article")
if result["success"]:
    print(result["title"])
    print(result["content"])  # Clean markdown
```

### Markdown Management (tools/markdown.py)

Essay file operations:

```python
from tools.markdown import save_outline, save_section, list_sections

save_outline("police-malpractice-insurance", "# Essay Outline...")
save_section("police-malpractice-insurance", "Introduction", "# Introduction...")
sections = list_sections("police-malpractice-insurance")
```

## Development Status

- [x] Directory structure
- [x] SQLite database with article storage
- [x] Jina Reader integration
- [x] Markdown file management
- [x] **Ra (Research Agent) - Ready for testing!**
- [ ] Oa (Outline Agent) - Next up
- [ ] Ja (Journalist Agent) - After outline works
- [ ] Ea (Editor Agent) - Final piece

## Design Principles

- **Start simple, iterate**: SQLite, not Neo4J or Supabase (yet)
- **Agents orchestrate, tools execute**: Agents have instructions, tools have logic
- **Archive everything**: Store full article content for later reference
- **One section at a time**: Avoid context limits by writing incrementally
- **working.toml as focus pointer**: Agents always know current essay

## Why This Approach?

Based on your experience:
- ✗ Notion MCP struggled with long text and reliability
- ✓ Claude Code has better context management (compact tool)
- ✓ Python tools = maximum flexibility
- ✓ Local markdown = use VSCode or Obsidian as viewer
- ✓ SQLite = simple, can add vector search later if needed
- ✓ Agent coordination via working.toml = clean state management

## Future Enhancements

- Vector embeddings for similarity search in research
- PDF archiving via Puppeteer
- Reddit comment scraping for meta-context
- Sentiment analysis on research and output
- Kanban view for managing multiple essay ideas
- Obsidian integration for better markdown viewing

## Testing Ra

Try it now:

```bash
@ra research "police malpractice insurance"
@ra research "ranked choice voting adoption"
@ra research "universal basic income feasibility"
```

Then check:
- `working.toml` - see current essay state
- `knowledge/articles.db` - browse with `sqlite3` or DB browser
- Python test: `python -c "from tools.db import get_articles_for_essay; print(get_articles_for_essay('police-malpractice-insurance'))"`

## License

MIT
