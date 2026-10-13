---
id: ddia
title: "Designing Data-Intensive Applications"
subtitle: "Reliable, Scalable, and Maintainable Systems"
author: "Martin Kleppmann"
subject: "Systems"
classLevel: 5
coverColor: "#b91c1c"
coverImage: "/books/ddia/cover.png"
sourcePdf: "/books/ddia/Designing_Data_Intensive_Applications.pdf"
icon: "🐗"
slot: 5
isInteractive: true
---

# Designing Data-Intensive Applications
*Reliable, Scalable, and Maintainable Systems* — By Martin Kleppmann

<!-- Page 1 -->
## Chapter 1: Reliable, Scalable & Maintainable Systems
### Foundations & Core Building Blocks

**Learning Objectives:**
- Distinguish between compute-intensive and data-intensive applications
- Understand standard building blocks: Databases, Caches, Search Indexes, Streams
- Grasp the primary constraints: volume, complexity, and velocity of data
- Analyze the distinction between hardware/software faults and system failure

**Key Concepts:**
- Reliable systems continue to function correctly even when hardware or software faults occur.
- Scalable architectures gracefully handle growth in traffic volume and dataset size.
- Maintainability ensures engineering teams can evolve the codebase productively over time.

**Formula/Summary:** `Data System = Storage + Cache + Query Engine + Stream Pipeline`

> 💡 Kleppmann Tip: Fault is not the same as failure! A fault is one component deviating from spec; a failure is the entire system stopping.

*Footer: Page 1 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 2 -->
## Chapter 1: Scalability & Measuring Load
### Latency, Throughput & Percentiles

**Learning Objectives:**
- Differentiate between throughput and response time
- Understand why median (p50) and high percentiles (p95, p99, p99.9) matter
- Analyze head-of-line blocking and tail latency amplification in microservices

**Key Concepts:**
- Average response time is misleading; percentiles reveal the true user experience.
- Tail latencies directly impact high-value power users who have the most data.
- Coping with load: scale up (vertical) vs scale out (shared-nothing horizontal architecture).

**Formula/Summary:** `Tail Latency Amplification: P(all fast) = (p99)^N backend calls`

> 💡 Kleppmann Tip: Even if only 1% of backend calls are slow, an end-user request that touches 100 backend services has a 63% chance of being slow!

*Footer: Page 2 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 3 -->
## Chapter 2: Data Models & Query Languages
### Relational vs Document vs Graph Models

**Learning Objectives:**
- Analyze the Object-Relational Impedance Mismatch in application software
- Understand schema-on-read (Document/NoSQL) vs schema-on-write (Relational)
- Identify many-to-one and many-to-many relationship modeling tradeoffs

**Key Concepts:**
- Relational databases excel at joins and normalization without data duplication.
- Document databases offer schema flexibility and locality for tree-structured records.
- Graph models (Property graphs & Cypher) excel when relationships are highly interconnected.

**Formula/Summary:** `Relational: Normalized Joins | Document: Locality | Graph: Pointers & Traversals`

> 💡 Kleppmann Tip: Document databases are not schema-free; they are schema-on-read, meaning code assumes structure implicitly.

*Footer: Page 3 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 4 -->
## Chapter 3: Storage and Retrieval
### SSTables and LSM-Trees

**Learning Objectives:**
- Understand append-only write logs and in-memory Memtables (Red-Black / AVL trees)
- Grasp the mechanics of Sorted String Tables (SSTables) and background Compaction
- Leverage Bloom Filters to avoid expensive disk seeks for non-existent keys

**Key Concepts:**
- Writes are sequentially appended to a write-ahead log (WAL) and stored in Memtable.
- When Memtable exceeds threshold, it flushes to disk as a new sorted SSTable segment.
- Merging and compaction runs asynchronously in background, discarding overwritten keys.

**Formula/Summary:** `LSM-Tree: Sequential Writes -> Memtable Flush -> Leveled Compaction`

> 💡 Kleppmann Tip: Sequential writes to disk or SSD are orders of magnitude faster than random writes, which is why LSM-trees achieve stellar write throughput.

*Footer: Page 4 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 5 -->
## Chapter 3: B-Trees vs LSM-Trees
### B-Trees vs LSM-Trees & Column Storage

**Learning Objectives:**
- Examine page-based storage (traditional 4KB/8KB B-Tree fixed blocks)
- Compare Write Amplification, Read Amplification, and Space Amplification
- Understand OLTP (row-oriented) versus OLAP (column-oriented) workloads

**Key Concepts:**
- B-Trees update in-place by overwriting disk pages; requires Write-Ahead Log for crash safety.
- LSM-Trees typically sustain higher write throughput; B-Trees offer faster predictable reads.
- Columnar engines (Parquet, ClickHouse) compress similar column data with bitmap/delta encoding.

**Formula/Summary:** `B-Tree: O(log N) Reads in-place | LSM: High sequential write throughput`

> 💡 Kleppmann Tip: If your workload is read-heavy with strict latency SLA, B-Trees win. If write throughput dominates, LSM-Trees shine.

*Footer: Page 5 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 6 -->
## Chapter 5: Replication & Consistency
### Leaders, Followers & Replication Lag

**Learning Objectives:**
- Understand synchronous vs asynchronous single-leader replication
- Analyze problems with replication lag: Reading Your Own Writes & Monotonic Reads
- Evaluate multi-leader and leaderless replication (Dynamo-style quorums)

**Key Concepts:**
- Read-after-write consistency guarantees a user always sees their own submitted updates.
- Monotonic reads prevent time travel anomalies where successive reads see older states.
- Quorums require w + r > n to guarantee that read and write sets overlap on at least one node.

**Formula/Summary:** `Quorum Condition: w + r > n (ensures read/write overlap)`

> 💡 Kleppmann Tip: Even with w + r > n, sloppy quorums and concurrent writes mean edge cases can still return stale values without consensus.

*Footer: Page 6 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 7 -->
## Chapter 7: Transactions & Isolation Levels
### The Reality of ACID & Concurrency Control

**Learning Objectives:**
- Deconstruct ACID: Atomicity, Consistency, Isolation, and Durability
- Master weak isolation anomalies: Dirty Reads, Non-repeatable Reads, and Read Skew
- Understand Snapshot Isolation (MVCC) and Serializable Snapshot Isolation (SSI)

**Key Concepts:**
- Atomicity is about abortability: if a transaction fails halfway, all changes are discarded.
- Snapshot Isolation uses Multi-Version Concurrency Control (MVCC) so readers never block writers.
- Write Skew occurs when two concurrent transactions read overlapping data and update distinct objects.

**Formula/Summary:** `ACID: Atomicity + Consistency + Isolation (MVCC) + Durability`

> 💡 Kleppmann Tip: 'Consistency' in ACID is an application invariant (e.g. balance >= 0), whereas in CAP it means linearizability (recency guarantee).

*Footer: Page 7 of 8 · Designing Data-Intensive Applications*

---

<!-- Page 8 -->
## Chapter 9: Distributed Consensus
### Linearizability, Total Order & Paxos/Raft

**Learning Objectives:**
- Understand linearizability: making a distributed system appear as a single atomic register
- Grasp the relationship between Total Order Broadcast and Consensus
- Analyze Epoch numbers, Leader Election, and Byzantine Fault Tolerance

**Key Concepts:**
- Total order broadcast guarantees messages are delivered to all nodes in the exact same sequence.
- Consensus algorithms (Raft, Multi-Paxos, Zab) ensure safe leader election and state machine replication.
- Two-Phase Commit (2PC) is a blocking atomic commit protocol; consensus is fault-tolerant non-blocking.

**Formula/Summary:** `Consensus = Agreement + Integrity + Validity + Termination`

> 💡 Kleppmann Tip: Total order broadcast is equivalent to consensus: solving one solves the other!

*Footer: Page 8 of 8 · Designing Data-Intensive Applications*

---
