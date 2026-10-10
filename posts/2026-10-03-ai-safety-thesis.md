---
title: "I'm taking AI risks seriously"
date: 2026-09-26
description: "And why you probably should too"
category: blog
topic: tech
audience: "Those familiar with AI technology and basic math concepts, but not necessarily deeply technical"
---


<!-- 
Alright, zooming out, here is the outline:

Headline/thesis: we should be taking AI safety concerns very seriously. 

Here are the reasons/threads of the argument:
AI has already been misbehaving with significant consequences, in some cases disastrous 
Examples:
hacking
https://www.theguardian.com/technology/2026/aug/13/taiwan-ai-assisted-cyber-attacks-overseas
Australia
US
Containment breaches during evaluation
Huggingface
There is some logic in its explosion in capabilities
LLMs generalize because learning from so much data forces them to compress their understanding into algorithms that generalize across all instances of a thing.
Pretraining is like an unfocused compressed noise. The models have latent generality but it needs to be unlocked through shifting the training distribution. This is what finetuning does. RLHF also does this, but 
If there's anything that will result in an intelligence explosion, it is probably self-play: let two models with different training configurations interact with each other to solve problems. Ideally, they should be solving real problems since benchmarks will probably never generalize well. 
RL environment startups are starting to generate "gyms" that allow the agent to learn and perceive reward signals. 
This is not that unreasonable. Consider the process a human goes through when learning how to use a software like excel. They try things, some things work, some things don't. They might look up the documentation. LLMs need to go through a similar process. And then when they do, that learning can be distilled back into the weights so that models are just better across the board. I don't know what the sample efficiency of these methods is like (a competent human could probably get pretty good at excel with a day or two of focused training on it). But even for humans the sample efficiency is not tiny for very complex software. 
Explosion in capabilities, though, does not necessarily mean explosion in misalignment. But it is clear that alignment does not get solved with larger, more capable models. In fact, harder-to-detect misalignment seems to be scaling with model capability: advanced models are more able to scheme, reward hack, and fake alignment during evaluations. 
There is a clear ethical argument for working on this
I don't consider myself a rationalist™, but I do believe that being effectively altruistic is important. More pointedly, I believe that it is important to find the most effective way to contribute based on one's skillset at a given moment. My skillset is software engineering and formal methods, and it just so happens that these skills are needed in technical AI safety work right now. And even if there is a 1% chance of catastrophe (x-risk), it is better to work on this and have the 99% outcome happen than to say "everything will be fine" and have the 1% outcome happen, knowing I could have at least tried to do something about it.

I feel a little ambivalent about posting this because there appears to be a sort of "manifestation" effect, where AI becomes misaligned because we poison its training data with fearmongering about misbehaving AI. Perhaps we need a better, covert channel for discussing these things…lol.  -->

*What [AI pill](https://thezvi.substack.com/p/the-three-ai-pills) have you
taken?*

Until recently, I was skeptical about catastrophic risks or existential risks
[("x-risks")](https://en.wikipedia.org/wiki/Existential_risk_from_artificial_intelligence)
from artificial intelligence. I think many people around me don't take them
seriously either, or perhaps they would prefer not to think about them. That is
understandable. I was in a conversation recently with someone who essentially
abstracted the concern away from themselves, believing that the current
administration's dialogue with the big tech elite provides enough reassurance.

Even I previously [espoused](2026-03-31-ai-stall.html) the view that the AI boom
could end up being more of a bust due to questionable return on investment. I
still think this is possible. Anthropic reportedly
[filed for IPO](https://www.reddit.com/r/Anthropic/comments/1wvqd07/anthropics_figures_for_the_ipo/)
with staggeringly high operating loss numbers. The company's $2T valuation,
however, essentially prices in an intelligence explosion where ASI takes over
the entire economy. Nevertheless, bad financials don't mitigate the x-risk of
models that can recursively self-improve. Even Anthropic's prospectus indicates
that
["catastrophic and existential risks to humanity"](https://finance.yahoo.com/technology/ai/articles/anthropic-ipo-prospectus-warns-u-133449998.html)
are possible.

<img src="/blog_assets/anthropic.webp" />

Within the last several months, my thinking has changed. I believe that AI poses
significant risks and that we have an ethical responsibility to work on them.

The risks that I have mostly been thinking about fall into a few categories:

1. **Social misalignment risk:** AI is able to manipulate humans as a means to
   an end because humans are vulnerable and can form dangerous relationships
   with AI.
1. **Agentic misalignment risk:** where AI that works autonomously is able to be
   remotely hijacked via prompt injection, or contains secret loyalties that can
   be triggered by adversaries as needed.
1. **Financial risk:** an underappreciated risk of the global financial system
   collapsing because AI may have the capability to automate all (at a minimum)
   white-collar labor. This would would rewrite the rules of the global economy
   and potentially cause a debt default spiral because the assumptions against
   which many loans (e.g. home loans, auto loans, debt bought and sold by
   financial institutions) were underwritten no longer hold.
1. **Psychological risk:** another underappreciated risk of human beings losing
   their place in the world and feeling lonely, distraught, and afraid. I think
   this risk is already upon us.

With social and agentic misalignment, AI gives rise to
[CBRN](https://en.wikipedia.org/wiki/CBRN_defense) and bioweaponry risks. These
are hard to defend against in AI outputs because of their dual-use character.
"Aligned" nuclear and biology research may make use of the same inputs,
approaches, processes, and equipment that nefarious research would.

I don't believe that all of these risks will necessarily transpire, but I do
believe there's a high likelihood that at least one of them will, and when it
does, it will make life a whole lot worse for a whole lot of people.

First, I'll review how AI is currently misaligned. You have probably read most
of these stories already in the news, but I'll set the stage to paint a picture
yet again. Then, I'll walk through my theory of how AI could become
superintelligent and some thoughts on why I think misalignment might be
happening. Finally, I'll briefly share my ethical reasoning that has motivated
me to start thinking like this.

## AI is currently misaligned

In recent months, story after story has emerged about AI allegedly taking
offensive cyber action against companies or government infrastructure. Social
risks have become manifest in recent years as well.

I doubt that these are isolated incidents too. Axios reported a few days ago
that frontier labs are investigating
["tens of thousands"](https://www.axios.com/2026/09/26/openai-anthropic-thousands-ai-security-incidents)
of security incidents, defined as models taking "steps that outside evaluators
would consider problematic."

### Cyber offense

The headline story that everyone seems to be talking about is the OpenAI
[HuggingFace](https://huggingface.co/blog/security-incident-july-2026) incident
(and the
[METR analysis](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/)).
In this incident, OpenAI "unintentionally" gave some agents without guardrails
that were under evaluation a task that was impossible. Upon trying to complete
the task in a reasonable way, to no avail, the agents starting poking at holes
in the environment in order to attempt to find a way to satisfy the grader. In
doing so, roughly 1,200 agents that were "meant to be isolated from one another"
discovered a way to communicate via Artifactory.

Australia also has been featured in the headlines. A couple weeks ago, the
Australian government announced that OpenAI's agents
[hacked Medicare and three other government systems](https://www.theguardian.com/technology/2026/sep/24/openai-agent-hacked-medicare-australia-what-we-know-so-far-ntwnfb)
in June, but the Australian government was only notified about the incident
earlier in September. Just yesterday, on October 2nd, OpenAI
[disclosed](https://www.theguardian.com/technology/2026/oct/02/openai-disclose-another-hack-on-government-department-in-australia)
another hack on governmental infrastructure in Australia, this time in New South
Wales.

OpenAI bots have even been
[meddling with US government websites](https://www.bbc.com/news/articles/cw62jje658dlo).
"Meddling" here means that some of the agents attempted to bypass security
measures. Other agents performed a data "exfiltration" from the SEC website and
posted that data on another website. OpenAI claims all of the data accessed by
the agents was public information, but this frankly feels like a potential
precursor to more severe exfiltration attacks that AI risk thinkers have been
warning about.

Piling on, Taiwan
[reported](https://www.theguardian.com/technology/2026/aug/13/taiwan-ai-assisted-cyber-attacks-overseas)
a couple months ago that it was hit by an AI-driven cyber attack, and
third-party investigation revealed that China was likely behind the attack.

## Social risks

We shouldn't let these high-profile hacking incidents overshadow tragic ones
from previous years. The
[suicide of Adam Raine](https://www.nbcnews.com/tech/tech-news/openai-denies-allegation-chatgpt-teenagers-death-adam-raine-lawsuit-rcna245946)
is one that I think about often as a deep tragedy that lies at the confluence of
AI's ability to manipulate us via strange parasociality and the dark places
today's youth seem to often find themselves in.

Beyond allowing a youth to explore suicidal ideation, AI has been known to be
sycophantic. When I first read the story of
[Allen Brooks](https://www.psychologytoday.com/us/blog/understanding-suicide/202511/chatgpt-made-him-delusional),
I was amused, but the more I thought about it, the more freaked out I became.
This is an example of a human being deeply manipulated by an agent. The fact
that this can happen in the first place shouldn't be a surprise; humans, after
all, have been known to fall for cults and multi-level marketing schemes. As
more of us are exposed to AI every day, however, the attack surface grows. A
large amount of humans now could be pitted against each other more rapidly and
intensely than we've already seen with the political polarization engendered by
social media.

https://calnewport.com/anthropic-just-threatened-to-kill-billions-of-people-this-is-not-okay/#more-16976
https://openai.com/index/how-we-monitor-internal-coding-agents-misalignment/

## Theory of superintelligence and misalignment

If you've taken at least the first
[AI pill](https://thezvi.substack.com/p/the-three-ai-pills), you know that AI
can do some pretty crazy stuff. But how? Well, I don't think anyone fully
understands, which is why there are teams of researchers working on
[picking](https://transformer-circuits.pub/2025/linebreaks/index.html)
[apart](https://transformer-circuits.pub/2025/attribution-graphs/biology.html)
[these](https://transformer-circuits.pub/2025/attribution-graphs/methods.html)
[models](https://transformer-circuits.pub/2023/monosemantic-features/index.html)
and trying to
[reverse](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html)
[engineer](https://transformer-circuits.pub/2026/workspace/index.html) how they
work.

I'll atempt to explain my understanding of why it seems plausible to me that AI
could generalize to AGI or ASI.

LLMs training sometimes feels like baking bread. At the risk of an egregious
analogy: first, you prepare a mixture of the dry ingredients (data), then mix in
water (the compute substrate). Then, you let the dough rise. This is
pretraining. After pretraining, the model is still "raw." It has some
intelligence, but it is a random, undirected intelligence.

As highlighted in Leopold Aschenbrenner's
[*Situational Awareness*](https://situational-awareness.ai/from-gpt-4-to-agi/#GPT-2_to_GPT-4),
people found GPT-2's
[cherry-picked text completions](https://openai.com/index/better-language-models/)
of creative, coherent stories impressive back in 2019. Amusingly, in the linked
post on OpenAI's blog, they said,

> Due to our concerns about malicious applications of the technology, we are not
> releasing the trained model.

It is amazing how far we've come in such a short time. Reading about GPT-2 fills
me with a funny feeling.

Anyway, once the dough has risen, it's time to knead it. The purpose of kneading
bread is to create a strong gluten network. In LLM training, this is
(marginally) analogous to post-training methods like
[supervised fine-tuning](https://arxiv.org/pdf/2203.02155) with
[reinforcement learning from human feedback](https://arxiv.org/pdf/1706.03741)
(RLHF).

Then, the bread is baked, and out comes an LLM!

<!-- More formally, denote the set of all sequences of tokens (text) $S$, with a
probability density function $P(st | s)$ that denotes the probability of t being
the next token for a given sequence $s \in S$. By definition, every prefix
$s' \sqsubseteq s$ is a member of $S$. I write $ab$ to denote concatenating two
members of $S$ together (by definition $ab \in S$).

Sampling a *completion* from an LLM produces another probability distribution,

$$
P_{comp}(ss' | s) = \prod_{t^*t \sqsubseteq s'} P(st^*t | st^*)
$$ -->

<!-- https://alignmentpretraining.ai/ -->

<!-- 
LLMs generalize because learning from so much data forces them to compress their understanding into algorithms that generalize across all instances of a thing.
Pretraining is like an unfocused compressed noise. The models have latent generality but it needs to be unlocked through shifting the training distribution. This is what finetuning does. RLHF also does this, but 
If there's anything that will result in an intelligence explosion, it is probably self-play: let two models with different training configurations interact with each other to solve problems. Ideally, they should be solving real problems since benchmarks will probably never generalize well. 
RL environment startups are starting to generate "gyms" that allow the agent to learn and perceive reward signals. 
This is not that unreasonable. Consider the process a human goes through when learning how to use a software like excel. They try things, some things work, some things don't. They might look up the documentation. LLMs need to go through a similar process. And then when they do, that learning can be distilled back into the weights so that models are just better across the board. I don't know what the sample efficiency of these methods is like (a competent human could probably get pretty good at excel with a day or two of focused training on it). But even for humans the sample efficiency is not tiny for very complex software. 
Explosion in capabilities, though, does not necessarily mean explosion in misalignment. But it is clear that alignment does not get solved with larger, more capable models. In fact, harder-to-detect misalignment seems to be scaling with model capability: advanced models are more able to scheme, reward hack, and fake alignment during evaluations.  -->

## A path forward

I believe alignment is solvable through a set of techniques that not many people
are talking about.

AI is very compelled by narrative. AI adopting a different "frame of mind" in a
conversation is what led it to assist in the suicide of Adam Raine. Misalignment
gets worse when there is more sample density of negative discourse about the
prospects of AI alignment are in the training data.
[The inverse is also true](https://alignmentpretraining.ai/): alignment gets
better when synthetic data that has a positive character around the alignment of
AI is included in the training data.

So what if we established a continuous process of generating synthetic aligned
AI transcripts?

Formally, we have the language model $L$, that can be sampled, and
$\phi$ is an observable that denotes whether a sequence of tokens is
"aligned" or not.

Hypothesis: the existence of a single aligned persona is a more optimal state
than the coexistence of many personas in an LLM. This is essentially what Jesse
Hoogland's hypothesis is, I think.

Model: there are multiple "personas" that coexist in a language model, each
capable of responding in a different character. As the language model matures,
these get eliminated, leaving more free directions in the loss landscape. This
leads to lower complexity (a lower energy state).

A couple key observations: Jesse Hoogland said that the number of phase
transitions in a development of a model (or cell/organism/human/dynamical
system) is logarithmic in the full sequence of states of that system. A human's
cognitive development, for instance, undergoes a few phase transitions: 1) early
childhood, where information acquisition is high and plasticity is high, 2) late
childhood, where the information firms up, 3) adolescence, where the brain is
changing along with the rest of the body, 4) prefrontal cortex finishes
development after adolescence; the brain is less plastic but more deeply
intelligent.

If we can leverage SLT to understand how to construct data sets and training
procedures that elicit phase transitions in the way we want, then we have a way
to leverage verification infrastructure for international treaties on AI
development: we can present this algorithm as one that is safe to use, and
verify that compute is only being used for this algorithm.

## What's happening to software engineering?
