Find articles about the cost of hunger on gdp, the cost of means testing, find    datasets on these things in the us, include snap and wic and other countries    successful system

 Research articles about the cost of police misconduct, malpractice as anestablished policy proposal, includedatasets about average cost of bad cops and research about previously proposed articles

 -----

 Let's add our next Agent, the Outline Agent or Oa.

 We will need to be able to read the summaries or key points of our research to make the outline and ultimately save it in the essays directory like



We need to handle some amount of truncation for claude to be able to summarize, maybe we need to split at a certain character count or provide just part of it?


The ui still needs some tuning, I'm wondering how we should handle the logs, as you can see they're both above our app and within our app. The boxes are also not sticking to their width and are being smaller than we'd expect or want.

We need better concurrency management so we can search more than 10 articles and not get rate limited, I don't know if we need to use a throttle type utility or if there is a library that works best for this use case. I also don't know the exact rate limiting for our api key but it's pretty low idk. Maybe you can search for tiers?


Search Killology and police training programs, length and requirements for major metros

We should check the database after we search for links before we send to jina and to claude. We want to prevent burning tokens and requests summarizing the same article twice and different search queries may have output overlap.

Let's update our UI to add another action, [O] Sync Outline

It would trigger Oa on the current topic and then either create or update the outline based on the available research in our knowledge base


We should store the search query that triggered the search and summarization of an article so we can vet if its a good result or not.

Fix the task list color of the text that I've highlighted and only show the summary not the key points. And only the url in the logs
