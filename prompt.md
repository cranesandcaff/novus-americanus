I'm building "Novus Americanus" - a system for writing deeply researched, long-form political essays using AI agents in Claude Code.

# System Overview

I need 4 specialized Claude Code agents working together:
- **Ra** (Research Agent): Searches web, extracts articles, stores in knowledge base
- **Oa** (Outline Agent): Creates structured outlines from research
- **Ja** (Journalist Agent): Writes essay sections one at a time 
- **Ea** (Editor Agent): Reviews and provides feedback

# Architecture

Please create this structure:
```
/Users/patrickcauley/dev/novus-americanus/
├── .claude/
│   └── agents/
│       ├── ra.md          # Research Agent instructions
│       ├── oa.md          # Outline Agent instructions
│       ├── ja.md          # Journalist Agent instructions
│       └── ea.md          # Editor Agent instructions
├── tools/                 # Python utilities the agents call
│   ├── __init__.py
│   ├── search.py         # Web search functionality
│   ├── jina.py           # Jina Reader API integration
│   ├── db.py             # SQLite database operations
│   └── markdown.py       # Markdown file helpers
├── knowledge/
│   ├── articles.db       # SQLite with research storage
│   └── archives/         # Archived articles (PDFs)
├── essays/
│   └── .gitkeep
├── working.toml          # Current working context
├── requirements.txt
├── README.md
└── .gitignore
```

# Working Context (working.toml)

Agents read/write this file to track the current essay being worked on:
```toml
[current_essay]
slug = "police-malpractice-insurance"
title = "Solving Police Violence Through Malpractice Insurance"
status = "researching"  # researching, outlining, writing, editing, published
created_at = "2025-11-09T14:32:00Z"
last_updated = "2025-11-09T16:45:00Z"

[research]
last_query = "police malpractice insurance reform"
articles_found = 0
articles_archived = 0

[outline]
sections_planned = 0
sections_written = 0

[writing]
words_written = 0
target_words = 5000

[metadata]
notes = ""
priority = "medium"
tags = []
```

# How It Works

1. User starts research: `@ra research "police malpractice insurance"`
2. Ra creates working.toml, searches web, stores articles in SQLite
3. User creates outline: `@oa create outline` (reads working.toml to know which essay)
4. Oa generates outline, saves to essays/[slug]/outline.md
5. User writes sections: `@ja write section "Introduction"`
6. Ja writes one section at a time, updates working.toml

Agents can also accept explicit essay slugs: `@oa create outline for "different-essay"`

# Technical Requirements

- **Database**: SQLite (design schema as needed, keep it simple)
- **Article extraction**: Jina Reader API - prepend URLs with https://r.jina.ai/
- **TOML parsing**: Use Python's tomli/tomllib for reading working.toml
- **Markdown storage**: Each essay in essays/[slug]/ with outline.md and sections/

# First Steps

1. Create the directory structure
2. Initialize working.toml with empty/default values
3. Create basic tools/db.py (let SQLite schema evolve as needed, don't overthink it)
4. Create tools/jina.py for article extraction
5. Build Ra agent (.claude/agents/ra.md) that can:
   - Take a research topic
   - Initialize/update working.toml
   - Search and store articles
   - Report progress

# Design Principles

- Start simple, iterate based on real usage
- Don't over-engineer the database schema upfront
- Agents orchestrate, tools execute
- Always archive original sources
- Keep working.toml as the "current focus" pointer

Let's begin by creating the directory structure, initializing working.toml, and building the Ra agent with basic article storage.