# Strands Decider — Evaluation for CivicFlow AI

Investigation and recommendation only. No production code was changed. Sources: the
[strands-decider repository](https://github.com/strands-labs/strands-decider) README,
`docs/inference.md`, and `examples/strands/README.md` (fetched and read directly).

---

## 1. What Strands Decider is

### 1.1 Verified facts (from the repository)

- **It is a decision model, not an LLM.** It does not generate text. It answers typed
  questions about a "state" (the input text): `noul` (yes/no → P(true)), `choice` (one of N
  options, with a calibrated confidence), and `score` (a level on an ordered scale).
- **Model size:** the reference model `strands-decider-2B-hobson-v19` has **~1.9 billion
  parameters**. Architecture: a Qwen3.5-2B-Base decoder torso with the LM head removed and a
  ~1M-parameter pointer head; a rank-16 LoRA adapter; head runs in fp32.
- **Base weights download separately:** on first load it pulls **`Qwen/Qwen3.5-2B-Base`
  (~4.5 GB)** from Hugging Face. The checkpoint itself (LoRA + head + tokenizer) is small,
  but the ~4.5 GB torso is mandatory.
- **Runtime:** Python, `torch==2.7.1`, `transformers==5.17.0`, `peft==0.21.0`. Device is
  `cuda`, `mps` (Apple silicon), or `cpu` (explicitly chosen).
- **Latency (measured in the repo):** ~115 ms median / 299 ms p95 per question on an RTX
  3090 GPU; ~153 ms warm / 310 ms cold on an M3 Pro Mac. **CPU is "much slower"** (no figure
  given, but the GPU kernels fall back to reference PyTorch paths).
- **Confidence is computed, not predicted** — derived from the option distribution. The repo
  claims ≥0.9 confidence answers are right ~95% of the time on unseen short tasks; below that
  it recommends confirm/ask-a-human. Overall JevBench accuracy is **0.723 (167/231)**.
- **Serving model:** `strands-decider serve ... --port 8000` starts an HTTP server exposing
  `POST /v1/systemone` and `GET /health`. It **binds to `127.0.0.1`, has no authentication,
  and its behavior under concurrent requests is "not verified."** The docs explicitly say
  **"Use it for local experiments only."**
- **Strands integration:** via an ordinary HTTP client. The worked example runs the agent on
  Bedrock plus a **locally served decider** on port 8099, called from a Strands
  `before_tool_call` InterventionHandler. The repo calls the example "an illustration rather
  than a recommendation."
- **License:** **Apache License 2.0** (permissive; redistribution/commercial use allowed with
  attribution and license notice).
- **Maturity signals:** reference model is v19; v20 did not displace it. 231-task benchmark
  with ~3.2-task run-to-run noise. The server is self-described as experiment-grade.

### 1.2 Technical inference (reasonable, not stated verbatim)

- **It will not run well inside a standard AWS Lambda function.** A ~1.9B-param PyTorch model
  plus a ~4.5 GB base-weights download exceeds comfortable Lambda limits: the download alone
  blows past the 512 MB–10 GB ephemeral/`/tmp` and image constraints unless pre-baked into a
  container image, cold starts would be tens of seconds, and Lambda has **no GPU** so you'd
  be on the "much slower" CPU path. Even if forced in, cold-start latency and memory make it
  unreliable for a request-path.
- **It is designed to be a long-running server**, not a per-invocation library — the HTTP
  serve mode, the shared-prefix KV cache (many questions per loaded state are "nearly free"),
  and the GPU latency numbers all point to a persistent process.
- **A GPU is strongly preferred** for the latency numbers to hold; CPU-only would likely be
  several hundred ms to seconds per question.
- **The server is not production-hardened** (localhost bind, no auth, unverified concurrency),
  so any real deployment must add an auth layer, a network boundary, and load testing.

### 1.3 Items that require testing (cannot be concluded from docs)

- Actual CPU latency on an AWS instance (Fargate/EC2 without GPU).
- Concurrency behavior under real traffic (docs say "not verified").
- Classification quality on **civic-domain** inputs specifically (JevBench is general).
- Container image size after baking in torch + transformers + base weights, and whether it
  fits a Fargate task or needs EC2/SageMaker.
- Cold-load time (base-weight download + model load) on each runtime.

---

## 2. Does Decider help CivicFlow? Use-case-by-use-case

### A. Issue classification (road_damage / streetlight / waste / water / other)
**Appropriate in principle — this is exactly a `choice` question.** But CivicFlow already
does this two ways that are good enough and cheaper: (1) deterministic keyword hints in
`textEvidence.ts`, and (2) Bedrock Nova already returns a validated `category` as part of the
multimodal analysis it must run anyway. Adding Decider here is **redundant** with a Bedrock
call that already happens. Verdict: **not worth a new service for the MVP.**

### B. Urgency decision (YES/NO + confidence)
**A clean fit for a `noul` question.** However, CivicFlow's severity already comes from
Bedrock, and priority is a **deterministic factor model** (by design — explainable, not an
LLM guess). A separate yes/no urgency model would duplicate severity and muddy the
transparent priority story. Verdict: **not needed; keep priority deterministic.**

### C. Agent routing (choose road/flood/waste/infrastructure/general workflow)
**This is the single best theoretical fit** — routing is Decider's headline use case. But
CivicFlow's pipeline doesn't currently branch into separate per-category agents; it runs one
evidence-fusion pass. Routing only pays off if you first build multiple specialized
workflows. Verdict: **promising, but it requires new architecture that the MVP doesn't have.
Future enhancement.**

### D. Duplicate / similar issue detection
**Decider is the wrong tool here.** Similarity is a semantic-relationship problem best served
by embeddings/vector search or the current token+location heuristic. A `choice` of
same/different/needs-analysis would be a weak, uncalibrated proxy. Verdict: **do not use
Decider; keep the current heuristic, upgrade to Bedrock embeddings + vector store later.**

### E. Confidence gate (Decider fast-path, else Bedrock)
**Architecturally sound pattern** (cheap gate → escalate to deep reasoning). But in CivicFlow
the "deep reasoning" (Bedrock Nova multimodal) must run anyway to produce the structured
assessment and recommended action. So a gate in front of it saves little and adds a second
runtime. Verdict: **the pattern is good, but there's no expensive step to gate in the current
design.**

**Summary:** Every use case is either already covered by the Bedrock call CivicFlow must make
anyway, better served by deterministic logic / vector search, or requires new multi-agent
architecture the MVP doesn't have. Decider adds a heavyweight runtime without removing an
existing cost.

---

## 3. Where Decider *would* belong (if adopted later)

```
Citizen → API Gateway → Ask/Analyze Lambda → Strands Agent
   ├── Rekognition            (image → visual evidence)
   ├── Strands Decider (svc)  → FAST routing: which specialized workflow?   [FUTURE]
   ├── DynamoDB tools         (deterministic reads/writes)
   ├── (vector search)        (semantic duplicate detection)               [FUTURE]
   └── Amazon Bedrock (Nova)  (evidence fusion, interpretation, action)
```

Decider's only defensible slot is **routing/triage** (use case C), and only once CivicFlow
has multiple specialized downstream workflows worth routing between. It must **not** replace
Bedrock for evidence fusion, interpretation, or recommended action — those need generative,
contextual reasoning Decider cannot do.

---

## 4. Decision matrix (adjusted for CivicFlow reality)

| Decision | Technology | Why |
|---|---|---|
| Image labels / visual evidence | **Amazon Rekognition** | Purpose-built vision; already integrated |
| Category classification | **Bedrock Nova** (already runs) | Returned in the structured analysis CivicFlow must call anyway — no extra service |
| Severity | **Bedrock Nova** (observed) | Needs contextual judgment over fused evidence |
| Yes/no urgency | **Deterministic + severity** | Keep priority explainable; no separate model needed |
| Priority score | **Deterministic factor model** | Explainable, auditable — must NOT be an LLM/decider guess |
| Duplicate / similarity | **Token+location heuristic now; Bedrock embeddings + vector search later** | Semantic relationship, not a classification |
| Evidence fusion | **Bedrock Nova** | Generative, multimodal reasoning |
| Final recommended action | **Bedrock Nova** | Contextual reasoning |
| Database operations | **Agent tools (deterministic)** | Exact, no model needed |
| Agent routing between specialized workflows | **Strands Decider** *(future, if those workflows exist)* | Fast calibrated routing is Decider's core strength |

Net: **Decider has one future-only slot (routing). Nothing in today's MVP needs it.**

---

## 5. AWS deployment reality

**Can the all-in-Lambda design (API Lambda + Agent Lambda + Strands + Decider + Bedrock +
Rekognition + DynamoDB + S3) work?** — **No, not with Decider in Lambda.** Decider needs a
persistent process, a ~4.5 GB base model, and (for usable latency) a GPU. Lambda has no GPU,
cold starts would be severe, and the serve process model doesn't fit request-per-invocation.

If Decider were adopted, the smallest realistic options:

| Option | Complexity | Cost | Cold start | Reliability | Hackathon feasibility |
|---|---|---|---|---|---|
| Decider in Lambda | — | — | Tens of seconds, OOM risk | Poor | **Not viable** |
| **Fargate (CPU) service** behind the agent | Medium | Always-on task (~$15–40+/mo) | N/A (always warm) but **high CPU per-question latency** | Medium (CPU latency + add auth) | Marginal |
| **EC2 GPU (g5/g4dn)** service | High | GPU instance **~$0.5–1+/hr always on** | N/A warm; fast | Medium (cost + ops) | Poor for a hackathon budget |
| **SageMaker real-time endpoint (GPU)** | High | GPU endpoint always-on, costly | Warm after deploy | Medium | Poor for budget/time |
| **No Decider (current)** | Low | ~$0 idle, serverless | Only Bedrock/agent cold start | **High** | **Best** |

Every path that makes Decider *fast* (GPU) is an always-on, non-serverless, paid resource —
the opposite of CivicFlow's zero-idle-cost serverless profile, and a new standing cost + ops
burden days before a ship gate.

---

## 6. Ship-gate protection

The ship gate is pass/fail on the public app being live. Adding an always-on GPU/Fargate
inference service **increases** the number of things that can be down at judging time and
adds a new failure mode (service unreachable, OOM, cost cap hit). The current serverless
stack has no such standing dependency. If Decider were added, it would need a strict fallback
(Decider down → deterministic route or straight to Bedrock) and must never block a report —
which is more code and more risk for no MVP benefit.

---

## 7. Security considerations (if ever deployed)

- The serve process **binds to localhost with no auth** — exposing it requires putting it in
  a private subnet and fronting it with authenticated, in-VPC access only (never public).
- No AWS credentials in code; least-privilege task role; secrets via env/SSM.
- No citizen PII in logs (CivicFlow already follows this).
- Pin the base-model revision — the loader currently pulls Hugging Face `main`, which can
  change under you.

---

## 8. Proof-of-concept plan (if you want to validate before deciding)

Keep it **isolated from production**. Locally (or on one throwaway GPU instance):
1. `pip install strands-decider`; `strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19`.
2. Ask the civic cases: `--choice "category=road_damage,streetlight,waste,water,other"`,
   `--noul "Is this high priority?"`, `--choice "route=road,flood,waste,infrastructure,general"`
   on inputs like "Large pothole near the school."
3. Record: model load time, per-question latency (CPU vs GPU), memory, output + confidence,
   and error behavior.
4. Compare the classification/routing quality against what Bedrock Nova already returns.
Only if CPU latency and quality are both acceptable would a Fargate path even be worth
costing. **Do not touch the production pipeline during the POC.**

---

## 9. Final recommendation

**OPTION C — Do not use Strands Decider in the MVP. Keep it as a documented, experimental
future enhancement.**

Why:
1. **Reliable public deployment / ship gate:** Decider cannot run in Lambda and every
   fast deployment is an always-on GPU/Fargate service — new standing cost, new failure mode,
   new ops right before a pass/fail ship gate. Adding it *reduces* reliability.
2. **No measurable benefit today:** every decision Decider could make is already produced by
   the Bedrock Nova call CivicFlow must run anyway (category, severity), handled better by
   deterministic logic (priority), or better served by vector search (similarity). It removes
   no existing cost.
3. **Its one strong fit (routing) needs architecture CivicFlow doesn't have** — multiple
   specialized workflows to route between. That's a real future direction, not an MVP need.
4. **Minimal unnecessary infrastructure:** CivicFlow's serverless, zero-idle-cost design is a
   strength. A 2B model server is exactly the "unnecessary infrastructure" to avoid.
5. **Technical innovation is already strong** via the AWS Strands Agents SDK tool-using agent
   on Bedrock Nova — adopting Decider "because it's new" would trade reliability for novelty,
   which the task explicitly warns against.

**What to do instead:** mention Decider in the "Future Work" of the submission as a candidate
for **agent routing/triage** once CivicFlow has specialized per-category workflows, deployed
as a separate authenticated in-VPC inference service (Fargate/GPU) with a deterministic
fallback — explicitly out of scope for the hackathon MVP to protect the ship gate.

> If you later want it: build the specialized workflows first, run the POC in section 8,
> and only then add a fallback-guarded Fargate/GPU Decider service for routing. I will not
> change the production app for this unless you ask.
