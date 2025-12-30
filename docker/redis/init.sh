#!/bin/sh
# Redis initialization script - creates comprehensive sample data for ALL Redis types
# Target: ~1.5M total data points across 9 data types in 6 databases
# Each database contains 3 different data types

# Wait for Redis to be ready
sleep 2

REDIS_HOST="redis"
REDIS_PASS="dbview123"

echo "============================================"
echo "Redis Comprehensive Data Initialization"
echo "============================================"
echo "Target: ~1.5M data points across 6 databases"
echo "Each database: 3 data types"
echo ""

# ============================================
# DATABASE 0: STRING, HASH, LIST
# ============================================
echo "============================================"
echo "[DB 0] STRING, HASH, LIST"
echo "============================================"

# STRING in DB 0
echo "  [DB 0] Creating STRING data..."
(
    for i in $(seq 1 1000); do
        echo "SET cache:page:$i \"<html><title>Page $i</title><body>Content $i</body></html>\""
    done
    for i in $(seq 1 500); do
        echo "SET cache:api:$i '{\"id\":$i,\"name\":\"Item $i\",\"price\":$((i * 10))}'"
    done
    for i in $(seq 1 500); do
        echo "SET session:token:$i \"jwt_token_user_$i\""
    done
) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 0 --pipe 2>/dev/null
echo "    STRING: 2000 keys"

# HASH in DB 0
echo "  [DB 0] Creating HASH data..."
for prefix in "user:profile" "product:catalog"; do
    for k in $(seq 1 200); do
        (
            printf "HSET $prefix:$k"
            for f in $(seq 1 200); do
                printf " field_$f \"value_${k}_${f}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 0 --pipe 2>/dev/null
    done
done
echo "    HASH: 400 keys × 200 fields"

# LIST in DB 0
echo "  [DB 0] Creating LIST data..."
for prefix in "log:activity" "queue:jobs"; do
    for k in $(seq 1 200); do
        (
            printf "RPUSH $prefix:$k"
            for e in $(seq 1 200); do
                printf " \"entry_${k}_${e}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 0 --pipe 2>/dev/null
    done
done
echo "    LIST: 400 keys × 200 elements"

# ============================================
# DATABASE 1: SET, ZSET, STREAM
# ============================================
echo ""
echo "============================================"
echo "[DB 1] SET, ZSET, STREAM"
echo "============================================"

# SET in DB 1
echo "  [DB 1] Creating SET data..."
for prefix in "tags:user" "followers:user"; do
    for k in $(seq 1 200); do
        (
            printf "SADD $prefix:$k"
            for m in $(seq 1 200); do
                printf " \"member_${k}_${m}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 1 --pipe 2>/dev/null
    done
done
echo "    SET: 400 keys × 200 members"

# ZSET in DB 1
echo "  [DB 1] Creating ZSET data..."
for prefix in "leaderboard:game" "ranking:score"; do
    for k in $(seq 1 200); do
        (
            printf "ZADD $prefix:$k"
            for m in $(seq 1 200); do
                printf " $((m * 10 + k)) \"player_${m}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 1 --pipe 2>/dev/null
    done
done
echo "    ZSET: 400 keys × 200 members"

# STREAM in DB 1
echo "  [DB 1] Creating STREAM data..."
for prefix in "events:order" "events:payment"; do
    for k in $(seq 1 200); do
        (
            for e in $(seq 1 200); do
                echo "XADD $prefix:$k * type event_$((e % 5)) id $e data payload_$e"
            done
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 1 --pipe 2>/dev/null
    done
done
echo "    STREAM: 400 keys × 200 entries"

# ============================================
# DATABASE 2: BITMAP, HYPERLOGLOG, GEO
# ============================================
echo ""
echo "============================================"
echo "[DB 2] BITMAP, HYPERLOGLOG, GEO"
echo "============================================"

# BITMAP in DB 2
echo "  [DB 2] Creating BITMAP data..."
(
    for k in $(seq 1 2000); do
        for bit in 0 50 100 150 200 250 300 350 400; do
            echo "SETBIT bitmap:user:login:$k $bit 1"
        done
    done
    for k in $(seq 1 1000); do
        for bit in 0 30 60 90 120 150 180 210 240; do
            echo "SETBIT bitmap:feature:flag:$k $bit $((k % 2))"
        done
    done
) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 2 --pipe 2>/dev/null
echo "    BITMAP: 3000 keys"

# HYPERLOGLOG in DB 2
echo "  [DB 2] Creating HYPERLOGLOG data..."
for prefix in "hll:visitors:page" "hll:unique:ips"; do
    for k in $(seq 1 200); do
        (
            printf "PFADD $prefix:$k"
            for v in $(seq 1 200); do
                printf " \"elem_$((k * 200 + v))\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 2 --pipe 2>/dev/null
    done
done
echo "    HYPERLOGLOG: 400 keys × 200 elements"

# GEO in DB 2
echo "  [DB 2] Creating GEOSPATIAL data..."
for prefix in "geo:stores:city" "geo:drivers:zone"; do
    for k in $(seq 1 200); do
        (
            printf "GEOADD $prefix:$k"
            for loc in $(seq 1 200); do
                lon=$(( (k * 17 + loc * 31) % 360 - 180 ))
                lat=$(( (k * 13 + loc * 29) % 170 - 85 ))
                printf " $lon $lat \"loc_${k}_${loc}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 2 --pipe 2>/dev/null
    done
done
echo "    GEO: 400 keys × 200 locations"

# ============================================
# DATABASE 3: STRING, HASH, ZSET (different patterns)
# ============================================
echo ""
echo "============================================"
echo "[DB 3] STRING, HASH, ZSET"
echo "============================================"

# STRING in DB 3
echo "  [DB 3] Creating STRING data..."
(
    for i in $(seq 1 800); do
        echo "SET counter:visits:$i \"$((i * 100))\""
    done
    for i in $(seq 1 600); do
        echo "SET config:app:$i \"{\\\"enabled\\\":true,\\\"level\\\":$i}\""
    done
    for i in $(seq 1 600); do
        echo "SET lock:resource:$i \"locked_by_process_$i\""
    done
) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 3 --pipe 2>/dev/null
echo "    STRING: 2000 keys"

# HASH in DB 3
echo "  [DB 3] Creating HASH data..."
for prefix in "order:details" "inventory:stock"; do
    for k in $(seq 1 200); do
        (
            printf "HSET $prefix:$k"
            for f in $(seq 1 200); do
                printf " item_$f \"qty_$((f * k % 1000))\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 3 --pipe 2>/dev/null
    done
done
echo "    HASH: 400 keys × 200 fields"

# ZSET in DB 3
echo "  [DB 3] Creating ZSET data..."
for prefix in "timeline:posts" "priority:tasks"; do
    for k in $(seq 1 200); do
        (
            printf "ZADD $prefix:$k"
            for m in $(seq 1 200); do
                printf " $((1700000000 + m * 60)) \"item_${m}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 3 --pipe 2>/dev/null
    done
done
echo "    ZSET: 400 keys × 200 members"

# ============================================
# DATABASE 4: LIST, SET, STREAM (different patterns)
# ============================================
echo ""
echo "============================================"
echo "[DB 4] LIST, SET, STREAM"
echo "============================================"

# LIST in DB 4
echo "  [DB 4] Creating LIST data..."
for prefix in "messages:chat" "notifications:user"; do
    for k in $(seq 1 200); do
        (
            printf "RPUSH $prefix:$k"
            for e in $(seq 1 200); do
                printf " \"{\\\"id\\\":$e,\\\"text\\\":\\\"msg_$e\\\"}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 4 --pipe 2>/dev/null
    done
done
echo "    LIST: 400 keys × 200 elements"

# SET in DB 4
echo "  [DB 4] Creating SET data..."
for prefix in "permissions:role" "category:products"; do
    for k in $(seq 1 200); do
        (
            printf "SADD $prefix:$k"
            for m in $(seq 1 200); do
                printf " \"item_${k}_${m}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 4 --pipe 2>/dev/null
    done
done
echo "    SET: 400 keys × 200 members"

# STREAM in DB 4
echo "  [DB 4] Creating STREAM data..."
for prefix in "metrics:server" "audit:actions"; do
    for k in $(seq 1 200); do
        (
            for e in $(seq 1 200); do
                echo "XADD $prefix:$k * cpu $((e % 100)) mem $((50 + e % 50)) action act_$e"
            done
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 4 --pipe 2>/dev/null
    done
done
echo "    STREAM: 400 keys × 200 entries"

# ============================================
# DATABASE 5: BITMAP, HYPERLOGLOG, GEO (different patterns)
# ============================================
echo ""
echo "============================================"
echo "[DB 5] BITMAP, HYPERLOGLOG, GEO"
echo "============================================"

# BITMAP in DB 5
echo "  [DB 5] Creating BITMAP data..."
(
    for k in $(seq 1 1500); do
        for bit in 0 20 40 60 80 100 120 140 160; do
            echo "SETBIT bitmap:online:status:$k $bit 1"
        done
    done
    for k in $(seq 1 1500); do
        for bit in 0 15 30 45 60 75 90 105 120; do
            echo "SETBIT bitmap:daily:active:$k $bit $((k % 2))"
        done
    done
) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 5 --pipe 2>/dev/null
echo "    BITMAP: 3000 keys"

# HYPERLOGLOG in DB 5
echo "  [DB 5] Creating HYPERLOGLOG data..."
for prefix in "hll:searches:query" "hll:events:daily"; do
    for k in $(seq 1 200); do
        (
            printf "PFADD $prefix:$k"
            for v in $(seq 1 200); do
                printf " \"data_$((k * 200 + v))\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 5 --pipe 2>/dev/null
    done
done
echo "    HYPERLOGLOG: 400 keys × 200 elements"

# GEO in DB 5
echo "  [DB 5] Creating GEOSPATIAL data..."
for prefix in "geo:restaurants:area" "geo:events:venue"; do
    for k in $(seq 1 200); do
        (
            printf "GEOADD $prefix:$k"
            for loc in $(seq 1 200); do
                lon=$(( (k * 19 + loc * 37) % 360 - 180 ))
                lat=$(( (k * 11 + loc * 23) % 170 - 85 ))
                printf " $lon $lat \"place_${k}_${loc}\""
            done
            printf "\n"
        ) | redis-cli -h $REDIS_HOST -a $REDIS_PASS -n 5 --pipe 2>/dev/null
    done
done
echo "    GEO: 400 keys × 200 locations"

echo ""
echo "============================================"
echo "Redis Data Initialization Complete!"
echo "============================================"
echo ""
echo "Database Distribution (6 DBs × 3 types each):"
echo ""
echo "  DB 0: STRING, HASH, LIST"
echo "    - cache:page:*, cache:api:*, session:token:*"
echo "    - user:profile:*, product:catalog:*"
echo "    - log:activity:*, queue:jobs:*"
echo ""
echo "  DB 1: SET, ZSET, STREAM"
echo "    - tags:user:*, followers:user:*"
echo "    - leaderboard:game:*, ranking:score:*"
echo "    - events:order:*, events:payment:*"
echo ""
echo "  DB 2: BITMAP, HYPERLOGLOG, GEO"
echo "    - bitmap:user:login:*, bitmap:feature:flag:*"
echo "    - hll:visitors:page:*, hll:unique:ips:*"
echo "    - geo:stores:city:*, geo:drivers:zone:*"
echo ""
echo "  DB 3: STRING, HASH, ZSET"
echo "    - counter:visits:*, config:app:*, lock:resource:*"
echo "    - order:details:*, inventory:stock:*"
echo "    - timeline:posts:*, priority:tasks:*"
echo ""
echo "  DB 4: LIST, SET, STREAM"
echo "    - messages:chat:*, notifications:user:*"
echo "    - permissions:role:*, category:products:*"
echo "    - metrics:server:*, audit:actions:*"
echo ""
echo "  DB 5: BITMAP, HYPERLOGLOG, GEO"
echo "    - bitmap:online:status:*, bitmap:daily:active:*"
echo "    - hll:searches:query:*, hll:events:daily:*"
echo "    - geo:restaurants:area:*, geo:events:venue:*"
echo ""
echo "Summary (~1.5M total data points):"
echo "  STRING:      4,000 keys (DB 0, 3)"
echo "  HASH:        800 keys × 200 fields (DB 0, 3)"
echo "  LIST:        800 keys × 200 elements (DB 0, 4)"
echo "  SET:         800 keys × 200 members (DB 1, 4)"
echo "  ZSET:        800 keys × 200 members (DB 1, 3)"
echo "  STREAM:      800 keys × 200 entries (DB 1, 4)"
echo "  BITMAP:      6,000 keys (DB 2, 5)"
echo "  HYPERLOGLOG: 800 keys × 200 elements (DB 2, 5)"
echo "  GEOSPATIAL:  800 keys × 200 locations (DB 2, 5)"
echo ""
echo "Total: ~16,000 keys, ~1,500,000 data points"
echo ""
