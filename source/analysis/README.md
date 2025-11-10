# Text Analysis Toolkit

A comprehensive text analysis system designed specifically for evaluating political essay quality in the Novus Americanus agentic writing application.

## Overview

The Text Analysis Toolkit provides sophisticated analysis capabilities across five key dimensions:

1. **Readability** - Ensures content is accessible to target audience (10th-12th grade)
2. **Bias Detection** - Identifies problematic, insensitive, or biased language
3. **Style Analysis** - Evaluates passive voice, lexical diversity, transitions
4. **Structure** - Verifies logical flow, introduction, body, and conclusion
5. **Citations** - Checks for proper citation coverage of factual claims

## Architecture

```
source/
├── analysis/
│   ├── TextAnalysisToolkit.ts    # Core analysis functions
│   ├── index.ts                   # Exports
│   └── README.md                  # This file
└── tools/analysis/
    ├── ResearchAnalysisTools.ts   # Research agent tools
    ├── OutlineAnalysisTools.ts    # Outline agent tools
    ├── JournalistAnalysisTools.ts # Journalist agent tools
    ├── ReviewerAnalysisTools.ts   # Reviewer agent tools
    └── index.ts                   # Exports
```

## Core Functions

### `analyzeReadability(text: string)`

Calculates multiple readability metrics to ensure content is accessible.

**Returns:**

- `fleschKincaidGrade` - Reading grade level (target: 10-12)
- `gunningFog` - Complexity index (target: ≤14)
- `automatedReadabilityIndex` - ARI score
- `smog` - SMOG readability
- `daleChall` - Dale-Chall score
- `estimatedReadingTimeMinutes` - Based on 250 WPM
- `wordCount` - Total words

**Target Metrics for Political Essays:**

- Flesch-Kincaid Grade: 10-12 (high school level)
- Gunning Fog: ≤14 (college level acceptable)
- Reading time: Appropriate for audience

### `detectBias(text: string)`

Uses `retext-equality` to identify biased, insensitive, or problematic language.

**Detects:**

- Gendered language (chairman → chair, businessmen → business people)
- Ableist terms
- Age-based bias
- Other insensitive language

**Returns:**

- Count of issues found
- Specific problems with line/column numbers
- Suggested replacements

### `analyzeStyle(text: string)`

Evaluates writing style using NLP analysis.

**Returns:**

- `averageSentenceLength` - Words per sentence
- `passiveVoicePercentage` - Target: ≤10%
- `lexicalDiversity` - Vocabulary variety (target: ≥0.5)
- `complexWordPercentage` - 3+ syllable words
- `transitionDensity` - Transition words per sentence (target: ≥15%)
- `sentenceCount` - Total sentences

**Target Metrics:**

- Passive voice: ≤10% of sentences
- Lexical diversity: ≥0.5
- Transition density: ≥15%

### `analyzeStructure(text: string)`

Analyzes document organization and logical flow.

**Returns:**

- `hasIntroduction` - Boolean
- `hasConclusion` - Boolean
- `bodyParagraphCount` - Number of body paragraphs
- `headingCount` - Markdown headings
- `averageParagraphLength` - Words per paragraph
- `logicalFlow` - 'strong' | 'moderate' | 'weak'
- `transitionWords` - Array of transitions used

### `checkCitations(text: string)`

Verifies factual claims are properly cited.

**Detects Claims:**

- Percentages and statistics
- Dollar amounts
- Years/dates
- "According to" statements
- Research/study references

**Citation Formats Recognized:**

- `[1]` - Numbered references
- `(Author, 2020)` - APA-style
- `(Author et al., 2020)` - Multi-author
- Footnote symbols (^, †)

**Returns:**

- `totalCitations` - Count of citations
- `citationDensity` - Citations per sentence
- `unsubstantiatedClaims` - Claims without citations
- `needsCitation` - Boolean flag

### `checkRepetition(text: string)`

Identifies overused words and repeated phrases.

**Returns:**

- `overusedWords` - Words appearing too frequently (top 10)
- `repeatedPhrases` - Bigrams/trigrams repeated 3+ times

**Thresholds:**

- Overused: ≥2% of total words OR ≥3 occurrences
- Repeated phrase: ≥3 occurrences

## Agent-Specific Tools

### Research Agent Tools

```tsx
import {
	evaluateSource,
	detectSourceBias,
	analyzeSourceQuality,
} from './tools/analysis';

const evaluation = await evaluateSource(articleContent, url);
```

**Key Functions:**

- `evaluateSource()` - Comprehensive source credibility analysis
- `detectSourceBias()` - Bias detection for source material
- `analyzeSourceQuality()` - Fact density, citations, author attribution

**Credibility Scoring:**

- 100 base score
- -10 per bias issue
- -20 if no citations
- -10 if no author attribution
- -15 if reading level too low
- -10 if excessive passive voice
- -15 if low fact density

Use for research: Score ≥60 and bias issues ≤2

### Outline Agent Tools

```tsx
import {analyzeOutlineCoherence, checkOutlineStructure} from './tools/analysis';

const coherence = await analyzeOutlineCoherence(outlineText);
```

**Key Functions:**

- `analyzeOutlineCoherence()` - Logical flow and transitions
- `checkOutlineStructure()` - Essential components verification
- `analyzeOutlineTransitions()` - Section connection analysis

**Structure Requirements:**

- Introduction section
- ≥3 body sections
- Conclusion section
- Clear topic progression
- Balanced section lengths

### Journalist Agent Tools

```tsx
import {analyzeDraft, generateEditingRecommendations} from './tools/analysis';

const quality = await analyzeDraft(draftText);
```

**Key Functions:**

- `analyzeDraft()` - Comprehensive draft quality check
- `analyzePoliticalStyle()` - Style analysis
- `checkDraftRepetition()` - Repetition detection
- `generateEditingRecommendations()` - Prioritized suggestions
- `checkTargetReadability()` - Grade level verification

**Overall Quality Scoring:**

- 100 base score
- -15 if readability fails
- -20 if style fails
- -10 if repetition issues
- -10 if passive voice >15%
- -10 if reading level >13

Ready for review: Score ≥70

### Reviewer Agent Tools

```tsx
import {
	reviewComplete,
	checkOutlineAdherence,
	checkClaimsNeedCitation,
} from './tools/analysis';

const review = await reviewComplete(draft, outline, sources);
```

**Key Functions:**

- `reviewComplete()` - Full comprehensive review
- `checkOutlineAdherence()` - Outline coverage verification
- `checkClaimsNeedCitation()` - Citation gap analysis
- `generateRecommendations()` - Prioritized improvement list

**Publication Ready Criteria:**

- Overall score ≥85
- Zero critical (high severity) issues
- All outline sections covered
- All factual claims cited
- No biased language

## Anthropic SDK Integration

All agent tools include Anthropic function calling schemas:

```tsx
import {evaluateSourceTool} from './tools/analysis';

const tools = [evaluateSourceTool];

const response = await anthropic.messages.create({
	model: 'claude-3-5-sonnet-20241022',
	tools,
	messages: [{role: 'user', content: 'Evaluate this source...'}],
});
```

## Quality Standards for Political Essays

### Readability

- **Target:** 10th-12th grade (Flesch-Kincaid 10-12)
- **Max:** Gunning Fog ≤14
- **Rationale:** Accessible to educated general audience without being simplistic

### Style

- **Passive Voice:** ≤10%
- **Lexical Diversity:** ≥0.5
- **Transitions:** ≥15% of sentences
- **Rationale:** Clear, direct, well-connected writing

### Citations

- **Coverage:** 100% of factual claims
- **Density:** Sufficient for credibility
- **Priority:** All statistics, percentages, dollar amounts must be cited

### Bias

- **Tolerance:** Zero biased language
- **Detection:** Automated via retext-equality
- **Action:** Must be addressed before publication

### Structure

- **Required:** Introduction, ≥3 body paragraphs, conclusion
- **Flow:** Strong or moderate logical progression
- **Coherence:** Clear topic development

## Error Handling

All functions throw on empty or invalid input:

```tsx
try {
	const result = await analyzeReadability(text);
} catch (error) {
	console.error('Analysis failed:', error.message);
}
```

## Testing

Run tests with:

```bash
npm test
```

Test coverage includes:

- All core analysis functions
- Edge cases (empty text, extreme values)
- Target metrics validation
- Error handling

## Dependencies

- `text-readability` - Readability metrics calculation
- `retext` + `retext-equality` - Bias detection
- `compromise` - NLP and style analysis
- `unified` - Text processing pipeline

## Performance Considerations

- All analysis functions are async
- Multiple analyses can run in parallel:

```tsx
const [readability, bias, style] = await Promise.all([
	analyzeReadability(text),
	detectBias(text),
	analyzeStyle(text),
]);
```

- Typical analysis time: 100-500ms per function
- Recommended: Cache results for unchanged text

## Future Enhancements

Potential additions:

- Sentiment analysis for political neutrality
- Argument strength scoring
- Fact-checking integration
- Plagiarism detection
- Tone consistency analysis
