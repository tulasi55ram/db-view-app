# Redis Data Structure Documentation

This document describes the Redis data distribution across multiple databases for the DB View application.

## Overview

- **Total Databases**: 6 (DB 0 - DB 5)
- **Data Types per Database**: 3
- **Total Keys**: ~16,000
- **Total Data Points**: ~1,500,000

---

## Database Distribution

| Database | Data Type 1 | Data Type 2 | Data Type 3 |
|----------|-------------|-------------|-------------|
| **DB 0** | STRING | HASH | LIST |
| **DB 1** | SET | ZSET | STREAM |
| **DB 2** | BITMAP | HYPERLOGLOG | GEO |
| **DB 3** | STRING | HASH | ZSET |
| **DB 4** | LIST | SET | STREAM |
| **DB 5** | BITMAP | HYPERLOGLOG | GEO |

---

## Detailed Key Patterns by Database

### DB 0: STRING, HASH, LIST

| Data Type | Key Pattern | Count | Values/Key | Description |
|-----------|-------------|-------|------------|-------------|
| STRING | `cache:page:*` | 1,000 | 1 | HTML page cache |
| STRING | `cache:api:*` | 500 | 1 | API response cache |
| STRING | `session:token:*` | 500 | 1 | User session tokens |
| HASH | `user:profile:*` | 200 | 200 fields | User profile data |
| HASH | `product:catalog:*` | 200 | 200 fields | Product catalog info |
| LIST | `log:activity:*` | 200 | 200 elements | Activity logs |
| LIST | `queue:jobs:*` | 200 | 200 elements | Job queue entries |

**DB 0 Total**: 2,800 keys, ~162,000 data points

---

### DB 1: SET, ZSET, STREAM

| Data Type | Key Pattern | Count | Values/Key | Description |
|-----------|-------------|-------|------------|-------------|
| SET | `tags:user:*` | 200 | 200 members | User tags/interests |
| SET | `followers:user:*` | 200 | 200 members | User followers |
| ZSET | `leaderboard:game:*` | 200 | 200 members | Game leaderboards |
| ZSET | `ranking:score:*` | 200 | 200 members | Score rankings |
| STREAM | `events:order:*` | 200 | 200 entries | Order event streams |
| STREAM | `events:payment:*` | 200 | 200 entries | Payment event streams |

**DB 1 Total**: 1,200 keys, ~240,000 data points

---

### DB 2: BITMAP, HYPERLOGLOG, GEO

| Data Type | Key Pattern | Count | Values/Key | Description |
|-----------|-------------|-------|------------|-------------|
| BITMAP | `bitmap:user:login:*` | 2,000 | ~9 bits | User login tracking |
| BITMAP | `bitmap:feature:flag:*` | 1,000 | ~9 bits | Feature flag states |
| HYPERLOGLOG | `hll:visitors:page:*` | 200 | 200 elements | Page visitor counts |
| HYPERLOGLOG | `hll:unique:ips:*` | 200 | 200 elements | Unique IP tracking |
| GEO | `geo:stores:city:*` | 200 | 200 locations | Store locations |
| GEO | `geo:drivers:zone:*` | 200 | 200 locations | Driver locations |

**DB 2 Total**: 3,800 keys, ~160,000 data points

---

### DB 3: STRING, HASH, ZSET

| Data Type | Key Pattern | Count | Values/Key | Description |
|-----------|-------------|-------|------------|-------------|
| STRING | `counter:visits:*` | 800 | 1 | Visit counters |
| STRING | `config:app:*` | 600 | 1 | Application config |
| STRING | `lock:resource:*` | 600 | 1 | Resource locks |
| HASH | `order:details:*` | 200 | 200 fields | Order details |
| HASH | `inventory:stock:*` | 200 | 200 fields | Inventory stock levels |
| ZSET | `timeline:posts:*` | 200 | 200 members | Post timelines |
| ZSET | `priority:tasks:*` | 200 | 200 members | Task priority queues |

**DB 3 Total**: 2,800 keys, ~162,000 data points

---

### DB 4: LIST, SET, STREAM

| Data Type | Key Pattern | Count | Values/Key | Description |
|-----------|-------------|-------|------------|-------------|
| LIST | `messages:chat:*` | 200 | 200 elements | Chat messages |
| LIST | `notifications:user:*` | 200 | 200 elements | User notifications |
| SET | `permissions:role:*` | 200 | 200 members | Role permissions |
| SET | `category:products:*` | 200 | 200 members | Product categories |
| STREAM | `metrics:server:*` | 200 | 200 entries | Server metrics |
| STREAM | `audit:actions:*` | 200 | 200 entries | Audit action logs |

**DB 4 Total**: 1,200 keys, ~240,000 data points

---

### DB 5: BITMAP, HYPERLOGLOG, GEO

| Data Type | Key Pattern | Count | Values/Key | Description |
|-----------|-------------|-------|------------|-------------|
| BITMAP | `bitmap:online:status:*` | 1,500 | ~9 bits | Online status tracking |
| BITMAP | `bitmap:daily:active:*` | 1,500 | ~9 bits | Daily active users |
| HYPERLOGLOG | `hll:searches:query:*` | 200 | 200 elements | Search query counts |
| HYPERLOGLOG | `hll:events:daily:*` | 200 | 200 elements | Daily event counts |
| GEO | `geo:restaurants:area:*` | 200 | 200 locations | Restaurant locations |
| GEO | `geo:events:venue:*` | 200 | 200 locations | Event venue locations |

**DB 5 Total**: 3,800 keys, ~160,000 data points

---

## Data Types Summary

| Data Type | Databases | Total Keys | Data Points | Use Cases |
|-----------|-----------|------------|-------------|-----------|
| **STRING** | DB 0, DB 3 | 4,000 | 4,000 | Cache, sessions, counters, config, locks |
| **HASH** | DB 0, DB 3 | 800 | 160,000 | User profiles, products, orders, inventory |
| **LIST** | DB 0, DB 4 | 800 | 160,000 | Logs, queues, messages, notifications |
| **SET** | DB 1, DB 4 | 800 | 160,000 | Tags, followers, permissions, categories |
| **ZSET** | DB 1, DB 3 | 800 | 160,000 | Leaderboards, rankings, timelines, priorities |
| **STREAM** | DB 1, DB 4 | 800 | 160,000 | Events, payments, metrics, audit logs |
| **BITMAP** | DB 2, DB 5 | 6,000 | ~54,000 | Login tracking, feature flags, online status |
| **HYPERLOGLOG** | DB 2, DB 5 | 800 | 160,000 | Visitor counts, unique IPs, search counts |
| **GEO** | DB 2, DB 5 | 800 | 160,000 | Store locations, drivers, restaurants, venues |

---

## Connection Details

```
Host: localhost (or redis in Docker network)
Port: 6379
Password: dbview123
Databases: 0-5
```

---

## Quick Reference

```
DB 0 → STRING + HASH + LIST     (cache, users, products, logs, queues)
DB 1 → SET + ZSET + STREAM      (tags, followers, leaderboards, events)
DB 2 → BITMAP + HLL + GEO       (login tracking, visitors, store locations)
DB 3 → STRING + HASH + ZSET     (counters, config, orders, timelines)
DB 4 → LIST + SET + STREAM      (messages, permissions, metrics, audit)
DB 5 → BITMAP + HLL + GEO       (online status, searches, restaurants)
```

---

## Initialization

To populate this data, run:

```bash
# Start Redis with initialization
docker-compose up -d redis redis-init

# Or re-initialize
docker-compose down redis redis-init
docker-compose up -d redis redis-init

# Watch initialization logs
docker-compose logs -f redis-init
```
