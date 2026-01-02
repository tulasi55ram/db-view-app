/**
 * Redis Query View
 *
 * A specialized query editor for Redis commands with:
 * - Command autocomplete (GET, SET, HGETALL, etc.)
 * - Command history
 * - Multi-line command support
 * - Result visualization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, History, Trash2, Terminal, BookOpen } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import { QueryResultsGrid } from "./QueryResultsGrid";
import { getElectronAPI, type QueryHistoryEntry } from "@/electron";
import { useTheme } from "@/design-system";
import { toast } from "sonner";
import { createSmartRedisCompletion, type RedisAutocompleteData } from "@/utils/redisAutocomplete";

// Redis command categories with descriptions
// Comprehensive Redis commands with full examples
const REDIS_COMMANDS = {
  strings: [
    { cmd: "GET", args: "key", desc: "Get the value of a key", example: 'GET user:1001:name' },
    { cmd: "SET", args: "key value [EX seconds] [NX|XX]", desc: "Set string value", example: 'SET user:1001:name "John Doe"' },
    { cmd: "SETEX", args: "key seconds value", desc: "Set with expiration", example: 'SETEX session:abc123 3600 "user_data"' },
    { cmd: "SETNX", args: "key value", desc: "Set if not exists", example: 'SETNX lock:resource1 "locked"' },
    { cmd: "MGET", args: "key [key ...]", desc: "Get multiple keys", example: 'MGET user:1:name user:2:name user:3:name' },
    { cmd: "MSET", args: "key value [key value ...]", desc: "Set multiple keys", example: 'MSET user:1:name "John" user:1:email "john@example.com"' },
    { cmd: "INCR", args: "key", desc: "Increment by 1", example: 'INCR page:views:homepage' },
    { cmd: "INCRBY", args: "key increment", desc: "Increment by value", example: 'INCRBY user:1001:points 100' },
    { cmd: "INCRBYFLOAT", args: "key increment", desc: "Increment by float", example: 'INCRBYFLOAT product:price 19.99' },
    { cmd: "DECR", args: "key", desc: "Decrement by 1", example: 'DECR inventory:item:1001' },
    { cmd: "DECRBY", args: "key decrement", desc: "Decrement by value", example: 'DECRBY inventory:item:1001 5' },
    { cmd: "APPEND", args: "key value", desc: "Append to string", example: 'APPEND log:today " - New entry"' },
    { cmd: "STRLEN", args: "key", desc: "Get string length", example: 'STRLEN article:1001:content' },
    { cmd: "GETRANGE", args: "key start end", desc: "Get substring", example: 'GETRANGE message:1 0 99' },
    { cmd: "SETRANGE", args: "key offset value", desc: "Overwrite part of string", example: 'SETRANGE greeting 6 "Redis"' },
    { cmd: "GETSET", args: "key value", desc: "Set and return old value", example: 'GETSET counter "0"' },
    { cmd: "GETEX", args: "key [EX|PX|EXAT|PXAT|PERSIST]", desc: "Get and set expiry", example: 'GETEX mykey EX 60' },
    { cmd: "GETDEL", args: "key", desc: "Get and delete", example: 'GETDEL temp:data' },
  ],
  hashes: [
    { cmd: "HSET", args: "key field value [field value ...]", desc: "Set hash fields", example: 'HSET user:1001 name "John" email "john@example.com" age "30"' },
    { cmd: "HGET", args: "key field", desc: "Get hash field", example: 'HGET user:1001 email' },
    { cmd: "HGETALL", args: "key", desc: "Get all fields and values", example: 'HGETALL user:1001' },
    { cmd: "HMSET", args: "key field value [field value ...]", desc: "Set multiple fields", example: 'HMSET product:1001 name "Laptop" price "999" stock "50"' },
    { cmd: "HMGET", args: "key field [field ...]", desc: "Get multiple fields", example: 'HMGET user:1001 name email age' },
    { cmd: "HDEL", args: "key field [field ...]", desc: "Delete fields", example: 'HDEL user:1001 temp_field old_field' },
    { cmd: "HEXISTS", args: "key field", desc: "Check if field exists", example: 'HEXISTS user:1001 email' },
    { cmd: "HKEYS", args: "key", desc: "Get all field names", example: 'HKEYS user:1001' },
    { cmd: "HVALS", args: "key", desc: "Get all values", example: 'HVALS user:1001' },
    { cmd: "HLEN", args: "key", desc: "Get number of fields", example: 'HLEN user:1001' },
    { cmd: "HINCRBY", args: "key field increment", desc: "Increment field by int", example: 'HINCRBY user:1001 login_count 1' },
    { cmd: "HINCRBYFLOAT", args: "key field increment", desc: "Increment field by float", example: 'HINCRBYFLOAT product:1001 price 5.50' },
    { cmd: "HSETNX", args: "key field value", desc: "Set field if not exists", example: 'HSETNX user:1001 created_at "2024-01-01"' },
    { cmd: "HSTRLEN", args: "key field", desc: "Get field value length", example: 'HSTRLEN user:1001 bio' },
    { cmd: "HSCAN", args: "key cursor [MATCH pattern] [COUNT count]", desc: "Iterate hash fields", example: 'HSCAN user:1001 0 MATCH "*name*" COUNT 10' },
  ],
  lists: [
    { cmd: "LPUSH", args: "key element [element ...]", desc: "Prepend elements", example: 'LPUSH notifications:user:1001 "New message"' },
    { cmd: "RPUSH", args: "key element [element ...]", desc: "Append elements", example: 'RPUSH queue:tasks "task1" "task2" "task3"' },
    { cmd: "LPOP", args: "key [count]", desc: "Remove and get from head", example: 'LPOP queue:tasks' },
    { cmd: "RPOP", args: "key [count]", desc: "Remove and get from tail", example: 'RPOP queue:tasks 2' },
    { cmd: "LRANGE", args: "key start stop", desc: "Get range of elements", example: 'LRANGE recent:posts 0 9' },
    { cmd: "LINDEX", args: "key index", desc: "Get element by index", example: 'LINDEX mylist 0' },
    { cmd: "LSET", args: "key index element", desc: "Set element by index", example: 'LSET mylist 0 "updated_value"' },
    { cmd: "LLEN", args: "key", desc: "Get list length", example: 'LLEN queue:tasks' },
    { cmd: "LINSERT", args: "key BEFORE|AFTER pivot element", desc: "Insert element", example: 'LINSERT mylist BEFORE "pivot" "new_element"' },
    { cmd: "LREM", args: "key count element", desc: "Remove elements", example: 'LREM mylist 2 "duplicate"' },
    { cmd: "LTRIM", args: "key start stop", desc: "Trim list to range", example: 'LTRIM recent:activity 0 99' },
    { cmd: "LPOS", args: "key element [RANK rank] [COUNT count]", desc: "Get element position", example: 'LPOS mylist "target" COUNT 2' },
    { cmd: "LMOVE", args: "source destination LEFT|RIGHT LEFT|RIGHT", desc: "Move element between lists", example: 'LMOVE source dest LEFT RIGHT' },
    { cmd: "BLPOP", args: "key [key ...] timeout", desc: "Blocking pop from head", example: 'BLPOP queue:tasks 30' },
    { cmd: "BRPOP", args: "key [key ...] timeout", desc: "Blocking pop from tail", example: 'BRPOP queue:tasks 30' },
  ],
  sets: [
    { cmd: "SADD", args: "key member [member ...]", desc: "Add members", example: 'SADD tags:article:1001 "redis" "database" "nosql"' },
    { cmd: "SREM", args: "key member [member ...]", desc: "Remove members", example: 'SREM tags:article:1001 "old_tag"' },
    { cmd: "SMEMBERS", args: "key", desc: "Get all members", example: 'SMEMBERS tags:article:1001' },
    { cmd: "SISMEMBER", args: "key member", desc: "Check if member exists", example: 'SISMEMBER users:online "user:1001"' },
    { cmd: "SMISMEMBER", args: "key member [member ...]", desc: "Check multiple members", example: 'SMISMEMBER users:online "user:1001" "user:1002"' },
    { cmd: "SCARD", args: "key", desc: "Get set size", example: 'SCARD users:online' },
    { cmd: "SINTER", args: "key [key ...]", desc: "Intersection of sets", example: 'SINTER user:1:friends user:2:friends' },
    { cmd: "SINTERSTORE", args: "destination key [key ...]", desc: "Store intersection", example: 'SINTERSTORE mutual:friends user:1:friends user:2:friends' },
    { cmd: "SUNION", args: "key [key ...]", desc: "Union of sets", example: 'SUNION tags:post:1 tags:post:2 tags:post:3' },
    { cmd: "SUNIONSTORE", args: "destination key [key ...]", desc: "Store union", example: 'SUNIONSTORE all:tags tags:post:1 tags:post:2' },
    { cmd: "SDIFF", args: "key [key ...]", desc: "Difference of sets", example: 'SDIFF user:1:friends user:2:friends' },
    { cmd: "SDIFFSTORE", args: "destination key [key ...]", desc: "Store difference", example: 'SDIFFSTORE unique:friends user:1:friends user:2:friends' },
    { cmd: "SPOP", args: "key [count]", desc: "Remove random members", example: 'SPOP lottery:entries 3' },
    { cmd: "SRANDMEMBER", args: "key [count]", desc: "Get random members", example: 'SRANDMEMBER featured:products 5' },
    { cmd: "SMOVE", args: "source destination member", desc: "Move member between sets", example: 'SMOVE pending completed "task:1001"' },
    { cmd: "SSCAN", args: "key cursor [MATCH pattern] [COUNT count]", desc: "Iterate set members", example: 'SSCAN users:online 0 MATCH "user:*" COUNT 100' },
  ],
  sortedSets: [
    { cmd: "ZADD", args: "key score member [score member ...]", desc: "Add members with scores", example: 'ZADD leaderboard 1000 "player:1001" 950 "player:1002"' },
    { cmd: "ZREM", args: "key member [member ...]", desc: "Remove members", example: 'ZREM leaderboard "player:inactive"' },
    { cmd: "ZSCORE", args: "key member", desc: "Get member score", example: 'ZSCORE leaderboard "player:1001"' },
    { cmd: "ZRANK", args: "key member", desc: "Get member rank (low to high)", example: 'ZRANK leaderboard "player:1001"' },
    { cmd: "ZREVRANK", args: "key member", desc: "Get member rank (high to low)", example: 'ZREVRANK leaderboard "player:1001"' },
    { cmd: "ZRANGE", args: "key start stop [WITHSCORES]", desc: "Get range by rank", example: 'ZRANGE leaderboard 0 9 WITHSCORES' },
    { cmd: "ZREVRANGE", args: "key start stop [WITHSCORES]", desc: "Get range (high to low)", example: 'ZREVRANGE leaderboard 0 9 WITHSCORES' },
    { cmd: "ZRANGEBYSCORE", args: "key min max [WITHSCORES] [LIMIT]", desc: "Get range by score", example: 'ZRANGEBYSCORE scores 100 200 WITHSCORES LIMIT 0 10' },
    { cmd: "ZREVRANGEBYSCORE", args: "key max min [WITHSCORES]", desc: "Get range by score (reversed)", example: 'ZREVRANGEBYSCORE scores 200 100 WITHSCORES' },
    { cmd: "ZCARD", args: "key", desc: "Get set size", example: 'ZCARD leaderboard' },
    { cmd: "ZCOUNT", args: "key min max", desc: "Count members by score range", example: 'ZCOUNT leaderboard 100 500' },
    { cmd: "ZINCRBY", args: "key increment member", desc: "Increment member score", example: 'ZINCRBY leaderboard 10 "player:1001"' },
    { cmd: "ZLEXCOUNT", args: "key min max", desc: "Count by lex range", example: 'ZLEXCOUNT myset [a [z' },
    { cmd: "ZRANGEBYLEX", args: "key min max [LIMIT offset count]", desc: "Get by lex range", example: 'ZRANGEBYLEX myset [a [z LIMIT 0 10' },
    { cmd: "ZPOPMIN", args: "key [count]", desc: "Remove lowest scoring members", example: 'ZPOPMIN waiting:queue 1' },
    { cmd: "ZPOPMAX", args: "key [count]", desc: "Remove highest scoring members", example: 'ZPOPMAX leaderboard 3' },
    { cmd: "ZINTERSTORE", args: "dest numkeys key [key ...]", desc: "Store intersection", example: 'ZINTERSTORE out 2 zset1 zset2 WEIGHTS 2 3' },
    { cmd: "ZUNIONSTORE", args: "dest numkeys key [key ...]", desc: "Store union", example: 'ZUNIONSTORE out 2 zset1 zset2' },
    { cmd: "ZSCAN", args: "key cursor [MATCH pattern] [COUNT count]", desc: "Iterate sorted set", example: 'ZSCAN leaderboard 0 MATCH "player:*" COUNT 100' },
  ],
  keys: [
    { cmd: "KEYS", args: "pattern", desc: "Find keys by pattern (use SCAN in prod)", example: 'KEYS user:*' },
    { cmd: "SCAN", args: "cursor [MATCH pattern] [COUNT count] [TYPE type]", desc: "Iterate keys safely", example: 'SCAN 0 MATCH user:* COUNT 100 TYPE hash' },
    { cmd: "EXISTS", args: "key [key ...]", desc: "Check if keys exist", example: 'EXISTS user:1001 user:1002 user:1003' },
    { cmd: "DEL", args: "key [key ...]", desc: "Delete keys", example: 'DEL temp:key1 temp:key2' },
    { cmd: "UNLINK", args: "key [key ...]", desc: "Delete keys async", example: 'UNLINK large:key1 large:key2' },
    { cmd: "TYPE", args: "key", desc: "Get key type", example: 'TYPE user:1001' },
    { cmd: "TTL", args: "key", desc: "Get time to live (seconds)", example: 'TTL session:abc123' },
    { cmd: "PTTL", args: "key", desc: "Get time to live (milliseconds)", example: 'PTTL session:abc123' },
    { cmd: "EXPIRE", args: "key seconds", desc: "Set expiration in seconds", example: 'EXPIRE cache:data 3600' },
    { cmd: "PEXPIRE", args: "key milliseconds", desc: "Set expiration in ms", example: 'PEXPIRE temp:data 60000' },
    { cmd: "EXPIREAT", args: "key timestamp", desc: "Set expiration at timestamp", example: 'EXPIREAT mykey 1735689600' },
    { cmd: "PERSIST", args: "key", desc: "Remove expiration", example: 'PERSIST user:1001' },
    { cmd: "RENAME", args: "key newkey", desc: "Rename key", example: 'RENAME old:key new:key' },
    { cmd: "RENAMENX", args: "key newkey", desc: "Rename if new key doesn't exist", example: 'RENAMENX temp:key final:key' },
    { cmd: "COPY", args: "source destination [REPLACE]", desc: "Copy key value", example: 'COPY user:1001 user:1001:backup REPLACE' },
    { cmd: "DUMP", args: "key", desc: "Serialize key", example: 'DUMP mykey' },
    { cmd: "RESTORE", args: "key ttl serialized-value", desc: "Deserialize key", example: 'RESTORE mykey 0 "\\x00\\x03foo..."' },
    { cmd: "OBJECT ENCODING", args: "key", desc: "Get internal encoding", example: 'OBJECT ENCODING mykey' },
    { cmd: "OBJECT FREQ", args: "key", desc: "Get access frequency", example: 'OBJECT FREQ mykey' },
    { cmd: "OBJECT IDLETIME", args: "key", desc: "Get idle time", example: 'OBJECT IDLETIME mykey' },
    { cmd: "TOUCH", args: "key [key ...]", desc: "Update last access time", example: 'TOUCH key1 key2 key3' },
    { cmd: "RANDOMKEY", args: "", desc: "Get random key", example: 'RANDOMKEY' },
  ],
  streams: [
    { cmd: "XADD", args: "key ID field value [field value ...]", desc: "Add entry to stream", example: 'XADD events:user * action "login" user_id "1001" timestamp "2024-01-01"' },
    { cmd: "XREAD", args: "[COUNT count] [BLOCK ms] STREAMS key [key ...] ID [ID ...]", desc: "Read from streams", example: 'XREAD COUNT 10 STREAMS events:user 0' },
    { cmd: "XRANGE", args: "key start end [COUNT count]", desc: "Get range of entries", example: 'XRANGE events:user - + COUNT 100' },
    { cmd: "XREVRANGE", args: "key end start [COUNT count]", desc: "Get range (reversed)", example: 'XREVRANGE events:user + - COUNT 10' },
    { cmd: "XLEN", args: "key", desc: "Get stream length", example: 'XLEN events:user' },
    { cmd: "XINFO STREAM", args: "key [FULL [COUNT count]]", desc: "Get stream info", example: 'XINFO STREAM events:user' },
    { cmd: "XINFO GROUPS", args: "key", desc: "Get consumer groups", example: 'XINFO GROUPS events:user' },
    { cmd: "XINFO CONSUMERS", args: "key groupname", desc: "Get consumers in group", example: 'XINFO CONSUMERS events:user mygroup' },
    { cmd: "XGROUP CREATE", args: "key groupname ID [MKSTREAM]", desc: "Create consumer group", example: 'XGROUP CREATE events:user processors $ MKSTREAM' },
    { cmd: "XGROUP DESTROY", args: "key groupname", desc: "Delete consumer group", example: 'XGROUP DESTROY events:user processors' },
    { cmd: "XREADGROUP", args: "GROUP group consumer STREAMS key ID", desc: "Read as consumer", example: 'XREADGROUP GROUP processors worker1 COUNT 10 STREAMS events:user >' },
    { cmd: "XACK", args: "key group ID [ID ...]", desc: "Acknowledge messages", example: 'XACK events:user processors 1526569495631-0' },
    { cmd: "XPENDING", args: "key group [IDLE min-idle] [start end count] [consumer]", desc: "Get pending entries", example: 'XPENDING events:user processors - + 10' },
    { cmd: "XCLAIM", args: "key group consumer min-idle-time ID [ID ...]", desc: "Claim pending messages", example: 'XCLAIM events:user processors worker2 3600000 1526569495631-0' },
    { cmd: "XDEL", args: "key ID [ID ...]", desc: "Delete entries", example: 'XDEL events:user 1526569495631-0' },
    { cmd: "XTRIM", args: "key MAXLEN|MINID [~] threshold", desc: "Trim stream", example: 'XTRIM events:user MAXLEN ~ 1000' },
  ],
  pubsub: [
    { cmd: "PUBLISH", args: "channel message", desc: "Publish message to channel", example: 'PUBLISH notifications "New order received"' },
    { cmd: "SUBSCRIBE", args: "channel [channel ...]", desc: "Subscribe to channels", example: 'SUBSCRIBE notifications alerts' },
    { cmd: "PSUBSCRIBE", args: "pattern [pattern ...]", desc: "Subscribe to patterns", example: 'PSUBSCRIBE events:* alerts:*' },
    { cmd: "UNSUBSCRIBE", args: "[channel ...]", desc: "Unsubscribe from channels", example: 'UNSUBSCRIBE notifications' },
    { cmd: "PUNSUBSCRIBE", args: "[pattern ...]", desc: "Unsubscribe from patterns", example: 'PUNSUBSCRIBE events:*' },
    { cmd: "PUBSUB CHANNELS", args: "[pattern]", desc: "List active channels", example: 'PUBSUB CHANNELS notifications:*' },
    { cmd: "PUBSUB NUMSUB", args: "[channel ...]", desc: "Count subscribers", example: 'PUBSUB NUMSUB notifications alerts' },
    { cmd: "PUBSUB NUMPAT", args: "", desc: "Count pattern subscriptions", example: 'PUBSUB NUMPAT' },
  ],
  transactions: [
    { cmd: "MULTI", args: "", desc: "Start transaction", example: 'MULTI' },
    { cmd: "EXEC", args: "", desc: "Execute transaction", example: 'EXEC' },
    { cmd: "DISCARD", args: "", desc: "Discard transaction", example: 'DISCARD' },
    { cmd: "WATCH", args: "key [key ...]", desc: "Watch keys for changes", example: 'WATCH user:1001:balance' },
    { cmd: "UNWATCH", args: "", desc: "Unwatch all keys", example: 'UNWATCH' },
  ],
  scripting: [
    { cmd: "EVAL", args: "script numkeys [key ...] [arg ...]", desc: "Execute Lua script", example: 'EVAL "return redis.call(\'GET\', KEYS[1])" 1 mykey' },
    { cmd: "EVALSHA", args: "sha1 numkeys [key ...] [arg ...]", desc: "Execute cached script", example: 'EVALSHA d41d8cd98f00b204e9800998ecf8427e 1 mykey' },
    { cmd: "SCRIPT LOAD", args: "script", desc: "Load script to cache", example: "SCRIPT LOAD \"return redis.call('GET', KEYS[1])\"" },
    { cmd: "SCRIPT EXISTS", args: "sha1 [sha1 ...]", desc: "Check if scripts exist", example: 'SCRIPT EXISTS d41d8cd98f00b204e9800998ecf8427e' },
    { cmd: "SCRIPT FLUSH", args: "[ASYNC|SYNC]", desc: "Clear script cache", example: 'SCRIPT FLUSH' },
    { cmd: "SCRIPT KILL", args: "", desc: "Kill running script", example: 'SCRIPT KILL' },
  ],
  server: [
    { cmd: "PING", args: "[message]", desc: "Test connection", example: 'PING' },
    { cmd: "ECHO", args: "message", desc: "Echo message", example: 'ECHO "Hello Redis"' },
    { cmd: "INFO", args: "[section]", desc: "Get server info", example: 'INFO memory' },
    { cmd: "DBSIZE", args: "", desc: "Get number of keys", example: 'DBSIZE' },
    { cmd: "SELECT", args: "index", desc: "Switch database (0-15)", example: 'SELECT 1' },
    { cmd: "FLUSHDB", args: "[ASYNC|SYNC]", desc: "Clear current database", example: 'FLUSHDB ASYNC' },
    { cmd: "FLUSHALL", args: "[ASYNC|SYNC]", desc: "Clear all databases", example: 'FLUSHALL ASYNC' },
    { cmd: "CONFIG GET", args: "parameter", desc: "Get config value", example: 'CONFIG GET maxmemory' },
    { cmd: "CONFIG SET", args: "parameter value", desc: "Set config value", example: 'CONFIG SET maxmemory 256mb' },
    { cmd: "CLIENT LIST", args: "", desc: "List connected clients", example: 'CLIENT LIST' },
    { cmd: "CLIENT GETNAME", args: "", desc: "Get client name", example: 'CLIENT GETNAME' },
    { cmd: "CLIENT SETNAME", args: "name", desc: "Set client name", example: 'CLIENT SETNAME myapp' },
    { cmd: "CLIENT ID", args: "", desc: "Get client ID", example: 'CLIENT ID' },
    { cmd: "CLIENT KILL", args: "ip:port | ID client-id", desc: "Kill client connection", example: 'CLIENT KILL ID 12345' },
    { cmd: "MEMORY USAGE", args: "key [SAMPLES count]", desc: "Get key memory usage", example: 'MEMORY USAGE user:1001' },
    { cmd: "MEMORY DOCTOR", args: "", desc: "Memory health report", example: 'MEMORY DOCTOR' },
    { cmd: "MEMORY STATS", args: "", desc: "Memory statistics", example: 'MEMORY STATS' },
    { cmd: "TIME", args: "", desc: "Get server time", example: 'TIME' },
    { cmd: "LASTSAVE", args: "", desc: "Last save timestamp", example: 'LASTSAVE' },
    { cmd: "BGSAVE", args: "", desc: "Background save", example: 'BGSAVE' },
    { cmd: "BGREWRITEAOF", args: "", desc: "Background AOF rewrite", example: 'BGREWRITEAOF' },
    { cmd: "DEBUG SLEEP", args: "seconds", desc: "Sleep (for testing)", example: 'DEBUG SLEEP 1' },
    { cmd: "SLOWLOG GET", args: "[count]", desc: "Get slow queries", example: 'SLOWLOG GET 10' },
    { cmd: "SLOWLOG LEN", args: "", desc: "Slow log length", example: 'SLOWLOG LEN' },
    { cmd: "SLOWLOG RESET", args: "", desc: "Clear slow log", example: 'SLOWLOG RESET' },
  ],
  geo: [
    { cmd: "GEOADD", args: "key longitude latitude member [...]", desc: "Add geospatial items", example: 'GEOADD stores -122.4194 37.7749 "store:sf" -73.9857 40.7484 "store:nyc"' },
    { cmd: "GEOPOS", args: "key member [member ...]", desc: "Get positions", example: 'GEOPOS stores "store:sf" "store:nyc"' },
    { cmd: "GEODIST", args: "key member1 member2 [unit]", desc: "Get distance between members", example: 'GEODIST stores "store:sf" "store:nyc" km' },
    { cmd: "GEORADIUS", args: "key lon lat radius m|km|ft|mi [opts]", desc: "Query by radius", example: 'GEORADIUS stores -122.4194 37.7749 100 km WITHDIST COUNT 10' },
    { cmd: "GEORADIUSBYMEMBER", args: "key member radius unit [opts]", desc: "Query radius from member", example: 'GEORADIUSBYMEMBER stores "store:sf" 500 km WITHDIST' },
    { cmd: "GEOSEARCH", args: "key FROMMEMBER|FROMLONLAT BYRADIUS|BYBOX", desc: "Search geospatial", example: 'GEOSEARCH stores FROMMEMBER "store:sf" BYRADIUS 100 km ASC COUNT 5' },
    { cmd: "GEOHASH", args: "key member [member ...]", desc: "Get geohash strings", example: 'GEOHASH stores "store:sf"' },
  ],
  hyperloglog: [
    { cmd: "PFADD", args: "key element [element ...]", desc: "Add to HyperLogLog", example: 'PFADD visitors:today "user:1001" "user:1002" "user:1003"' },
    { cmd: "PFCOUNT", args: "key [key ...]", desc: "Get cardinality estimate", example: 'PFCOUNT visitors:today visitors:yesterday' },
    { cmd: "PFMERGE", args: "destkey sourcekey [sourcekey ...]", desc: "Merge HyperLogLogs", example: 'PFMERGE visitors:week visitors:mon visitors:tue visitors:wed' },
  ],
  bitmap: [
    { cmd: "SETBIT", args: "key offset value", desc: "Set bit at offset", example: 'SETBIT user:1001:logins 0 1' },
    { cmd: "GETBIT", args: "key offset", desc: "Get bit at offset", example: 'GETBIT user:1001:logins 0' },
    { cmd: "BITCOUNT", args: "key [start end]", desc: "Count set bits", example: 'BITCOUNT user:1001:logins' },
    { cmd: "BITOP", args: "operation destkey key [key ...]", desc: "Bitwise operation", example: 'BITOP AND result key1 key2' },
    { cmd: "BITPOS", args: "key bit [start [end]]", desc: "Find first bit", example: 'BITPOS user:logins 1' },
    { cmd: "BITFIELD", args: "key [GET type offset] [SET type offset value]", desc: "Bit field operations", example: 'BITFIELD mykey GET u8 0 SET u8 8 200' },
  ],
};

export interface RedisQueryViewProps {
  tab: {
    id: string;
    connectionKey?: string;
    connectionName?: string;
    sql?: string; // We reuse 'sql' field for command
    columns?: string[];
    rows?: Record<string, unknown>[];
    loading?: boolean;
    error?: string;
  };
  onTabUpdate: (
    tabId: string,
    updates: {
      sql?: string;
      columns?: string[];
      rows?: Record<string, unknown>[];
      loading?: boolean;
      error?: string;
      isDirty?: boolean;
    }
  ) => void;
}

export function RedisQueryView({ tab, onTabUpdate }: RedisQueryViewProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [persistedHistory, setPersistedHistory] = useState<QueryHistoryEntry[]>([]);
  const [showCommandRef, setShowCommandRef] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  // Redis autocomplete data (keys from the database)
  const autocompleteDataRef = useRef<RedisAutocompleteData>({
    keys: [],
    keyPatterns: [],
  });

  const api = getElectronAPI();
  const { resolvedTheme } = useTheme();

  // Load persisted history on mount
  useEffect(() => {
    if (tab.connectionKey && api) {
      api
        .getQueryHistory(tab.connectionKey)
        .then((history) => {
          setPersistedHistory(history);
        })
        .catch((err) => {
          console.error("Failed to load query history:", err);
        });
    }
  }, [tab.connectionKey, api]);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current) return;

    // Create smart Redis autocomplete
    const smartRedisAutocomplete = createSmartRedisCompletion(() => autocompleteDataRef.current);

    // Create theme based on current mode
    const isDark = resolvedTheme === "dark";
    const createEditorTheme = (dark: boolean) => EditorView.theme(
      {
        "&": {
          backgroundColor: dark ? "#171717" : "#ffffff",
          color: dark ? "#fafafa" : "#171717",
          height: "180px",
          fontSize: "14px",
          lineHeight: "1.5",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        },
        ".cm-content": {
          caretColor: "#ef4444",
          padding: "12px 0",
        },
        ".cm-line": {
          lineHeight: "1.5",
        },
        ".cm-cursor": {
          borderLeftColor: "#ef4444",
          borderLeftWidth: "2px",
          height: "1.2em !important",
        },
        ".cm-activeLine": {
          backgroundColor: dark ? "#262626" : "#f5f5f5",
        },
        ".cm-activeLineGutter": {
          backgroundColor: dark ? "#262626" : "#f5f5f5",
        },
        ".cm-gutters": {
          backgroundColor: dark ? "#171717" : "#fafafa",
          color: dark ? "#737373" : "#a3a3a3",
          border: "none",
          minWidth: "40px",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          padding: "0 12px 0 8px",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: "#ef4444",
          color: "#ffffff",
        },
        ".cm-selectionBackground": {
          backgroundColor: dark ? "#262626" : "#e5e5e5",
        },
        ".cm-tooltip": {
          backgroundColor: dark ? "#262626" : "#ffffff",
          border: dark ? "1px solid #404040" : "1px solid #e5e5e5",
          color: dark ? "#fafafa" : "#171717",
        },
        ".cm-tooltip-autocomplete": {
          backgroundColor: dark ? "#262626" : "#ffffff",
          border: dark ? "1px solid #404040" : "1px solid #e5e5e5",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: dark ? "#404040" : "#e5e5e5",
          color: dark ? "#fafafa" : "#171717",
        },
        ".cm-placeholder": {
          color: "#737373",
          lineHeight: "1.5",
        },
      },
      { dark }
    );

    const editorTheme = createEditorTheme(isDark);

    const startState = EditorState.create({
      doc: tab.sql || "",
      extensions: [
        EditorView.lineWrapping,
        history(),
        autocompletion({
          override: [smartRedisAutocomplete],
          activateOnTyping: true,
          maxRenderedOptions: 20,
          defaultKeymap: true,
        }),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              handleRunCommand();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        themeCompartment.current.of(editorTheme),
        readOnlyCompartment.current.of(EditorState.readOnly.of(tab.loading || false)),
        placeholderExt("Enter Redis command...\n\nExamples:\n  GET mykey\n  HGETALL user:1001\n  KEYS user:*\n  SET mykey \"value\" EX 3600"),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onTabUpdate(tab.id, { sql: newValue, isDirty: true });
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
    };
  }, []);

  // Update readonly state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(
          EditorState.readOnly.of(tab.loading || false)
        ),
      });
    }
  }, [tab.loading]);

  // Update theme when resolvedTheme changes
  useEffect(() => {
    if (viewRef.current) {
      const isDark = resolvedTheme === "dark";
      const newTheme = EditorView.theme(
        {
          "&": {
            backgroundColor: isDark ? "#171717" : "#ffffff",
            color: isDark ? "#fafafa" : "#171717",
          },
          ".cm-activeLine": {
            backgroundColor: isDark ? "#262626" : "#f5f5f5",
          },
          ".cm-activeLineGutter": {
            backgroundColor: isDark ? "#262626" : "#f5f5f5",
          },
          ".cm-gutters": {
            backgroundColor: isDark ? "#171717" : "#fafafa",
            color: isDark ? "#737373" : "#a3a3a3",
          },
          ".cm-selectionBackground": {
            backgroundColor: isDark ? "#262626" : "#e5e5e5",
          },
          ".cm-tooltip": {
            backgroundColor: isDark ? "#262626" : "#ffffff",
            border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
            color: isDark ? "#fafafa" : "#171717",
          },
          ".cm-tooltip-autocomplete": {
            backgroundColor: isDark ? "#262626" : "#ffffff",
            border: isDark ? "1px solid #404040" : "1px solid #e5e5e5",
          },
          ".cm-tooltip-autocomplete ul li[aria-selected]": {
            backgroundColor: isDark ? "#404040" : "#e5e5e5",
            color: isDark ? "#fafafa" : "#171717",
          },
        },
        { dark: isDark }
      );
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(newTheme),
      });
    }
  }, [resolvedTheme]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== tab.sql) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: tab.sql || "",
          },
        });
      }
    }
  }, [tab.sql]);

  // Handle run command
  const handleRunCommand = useCallback(async () => {
    if (!tab.sql?.trim() || !tab.connectionKey || !api) {
      if (!tab.connectionKey) {
        toast.error("No connection selected");
      }
      return;
    }

    const startTime = Date.now();
    onTabUpdate(tab.id, { loading: true, error: undefined });

    try {
      const result = await api.runQuery({
        connectionKey: tab.connectionKey,
        sql: tab.sql,
      });

      const duration = Date.now() - startTime;

      // Add to persistent history
      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        rowCount: result.rows.length,
        success: true,
      };

      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-50));

      onTabUpdate(tab.id, {
        columns: result.columns,
        rows: result.rows,
        loading: false,
      });

      toast.success(`Command executed (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const historyEntry: QueryHistoryEntry = {
        id: Date.now().toString(),
        sql: tab.sql,
        executedAt: Date.now(),
        duration,
        success: false,
        error: error.message || "Unknown error",
      };

      await api.addQueryHistoryEntry(tab.connectionKey, historyEntry);
      setPersistedHistory((prev) => [...prev, historyEntry].slice(-50));

      onTabUpdate(tab.id, {
        loading: false,
        error: error.message || "Failed to execute command",
      });

      toast.error(`Command failed: ${error.message}`);
    }
  }, [tab, onTabUpdate, api]);

  // Handle history selection (replaces entire content)
  const handleSelectFromHistory = useCallback(
    (sql: string) => {
      onTabUpdate(tab.id, { sql, isDirty: true });
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: sql },
        });
      }
    },
    [tab.id, onTabUpdate]
  );

  // Handle inserting example from command reference (appends if editor has content)
  const handleInsertExample = useCallback(
    (command: string) => {
      if (!viewRef.current) return;

      const currentValue = viewRef.current.state.doc.toString().trim();

      // If editor is empty, just insert the command
      if (!currentValue) {
        onTabUpdate(tab.id, { sql: command, isDirty: true });
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: command },
        });
      } else {
        // Append on a new line
        const insertText = "\n" + command;
        const newContent = currentValue + insertText;

        onTabUpdate(tab.id, { sql: newContent, isDirty: true });
        viewRef.current.dispatch({
          changes: { from: viewRef.current.state.doc.length, insert: insertText },
          selection: { anchor: viewRef.current.state.doc.length + insertText.length },
        });
      }

      // Focus editor after insert
      viewRef.current.focus();
    },
    [tab.id, onTabUpdate]
  );

  // Handle clear history
  const handleClearHistory = useCallback(async () => {
    if (!tab.connectionKey || !api) return;

    try {
      await api.clearQueryHistory(tab.connectionKey);
      setPersistedHistory([]);
      toast.success("Command history cleared");
    } catch (error: any) {
      toast.error(`Failed to clear history: ${error.message}`);
    }
  }, [tab.connectionKey, api]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar - z-10 ensures it stays above content */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-red-500">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-medium">Redis</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={handleRunCommand}
            disabled={tab.loading || !tab.sql?.trim()}
            className="h-7 px-3 rounded flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3" />
            Run
            <span className="opacity-70">(Cmd+Enter)</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCommandRef(!showCommandRef)}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showCommandRef
                ? "bg-red-500/20 text-red-500"
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Commands
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`h-7 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              showHistory
                ? "bg-red-500/20 text-red-500"
                : "bg-bg-tertiary hover:bg-bg-hover text-text-primary"
            }`}
          >
            <History className="w-3 h-3" />
            History
          </button>
        </div>
      </div>

      {/* Main content area with vertical resizing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Editor Panel - Resizable */}
          <Panel defaultSize={25} minSize={15} maxSize={60}>
            <div className="relative h-full">
              <div ref={editorRef} className="h-full" />
              {tab.error && (
                <div className="absolute inset-0 pointer-events-none border-2 border-red-500/50 rounded" />
              )}
              {tab.loading && (
                <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                    <span>Executing command...</span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Vertical Resize Handle */}
          <PanelResizeHandle className="h-1 bg-border hover:bg-red-500 transition-colors cursor-row-resize" />

          {/* Results Panel */}
          <Panel defaultSize={75} minSize={30}>
            <div className="h-full flex overflow-hidden">
              <PanelGroup direction="horizontal">
                <Panel defaultSize={showHistory || showCommandRef ? 60 : 100} minSize={40}>
                  <QueryResultsGrid
                    columns={tab.columns || []}
                    rows={tab.rows || []}
                    loading={tab.loading || false}
                  />
                </Panel>

                {(showHistory || showCommandRef) && (
                  <>
                    <PanelResizeHandle className="w-1 bg-border hover:bg-red-500 transition-colors cursor-col-resize" />
                    <Panel defaultSize={40} minSize={25} maxSize={60}>
                      {showCommandRef ? (
                        <CommandReference onSelectCommand={(cmd) => handleInsertExample(cmd)} />
                      ) : (
                        <HistoryPanel
                          history={persistedHistory}
                          onSelectQuery={handleSelectFromHistory}
                          onClearHistory={handleClearHistory}
                        />
                      )}
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

// Quick examples for Redis
const REDIS_EXAMPLES = [
  { name: "Get Key", desc: "Get string value", cmd: 'GET mykey' },
  { name: "Set Key", desc: "Set string value", cmd: 'SET mykey "Hello World"' },
  { name: "Set with Expiry", desc: "Set with TTL (seconds)", cmd: 'SET session:123 "data" EX 3600' },
  { name: "Get All Hash Fields", desc: "Get all hash fields", cmd: 'HGETALL user:1001' },
  { name: "Set Hash Field", desc: "Set hash field", cmd: 'HSET user:1001 name "John" email "john@example.com"' },
  { name: "List Range", desc: "Get list items", cmd: 'LRANGE mylist 0 -1' },
  { name: "Push to List", desc: "Add to list head", cmd: 'LPUSH mylist "item1" "item2"' },
  { name: "Set Members", desc: "Get all set members", cmd: 'SMEMBERS myset' },
  { name: "Sorted Set Range", desc: "Get sorted set with scores", cmd: 'ZRANGE leaderboard 0 9 WITHSCORES' },
  { name: "Find Keys", desc: "Find keys by pattern", cmd: 'KEYS user:*' },
  { name: "Scan Keys", desc: "Iterate keys safely", cmd: 'SCAN 0 MATCH user:* COUNT 100' },
  { name: "Key TTL", desc: "Check time to live", cmd: 'TTL mykey' },
  { name: "Key Type", desc: "Check key type", cmd: 'TYPE mykey' },
  { name: "Delete Key", desc: "Delete one or more keys", cmd: 'DEL mykey otherkey' },
  { name: "Server Info", desc: "Get server information", cmd: 'INFO' },
  { name: "DB Size", desc: "Count keys in database", cmd: 'DBSIZE' },
];

// Command Reference Panel
function CommandReference({ onSelectCommand }: { onSelectCommand: (cmd: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("examples");

  const categories = [
    { id: "examples", label: "Examples", icon: "⚡" },
    { id: "strings", label: "Strings", icon: "📝" },
    { id: "hashes", label: "Hashes", icon: "#️⃣" },
    { id: "lists", label: "Lists", icon: "📋" },
    { id: "sets", label: "Sets", icon: "🔘" },
    { id: "sortedSets", label: "Sorted Sets", icon: "📊" },
    { id: "keys", label: "Keys", icon: "🔑" },
    { id: "streams", label: "Streams", icon: "📜" },
    { id: "pubsub", label: "Pub/Sub", icon: "📡" },
    { id: "transactions", label: "Transactions", icon: "🔄" },
    { id: "scripting", label: "Scripting", icon: "📜" },
    { id: "server", label: "Server", icon: "🖥️" },
    { id: "geo", label: "Geo", icon: "🌍" },
    { id: "hyperloglog", label: "HyperLogLog", icon: "📈" },
    { id: "bitmap", label: "Bitmap", icon: "🔲" },
  ];

  const commands = REDIS_COMMANDS[selectedCategory as keyof typeof REDIS_COMMANDS] || [];

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <BookOpen className="w-3 h-3" />
          Redis Commands
        </h3>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedCategory === cat.id
                ? "bg-red-500/20 text-red-500"
                : "bg-bg-tertiary hover:bg-bg-hover text-text-secondary"
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedCategory === "examples" ? (
          // Quick examples
          <>
            {REDIS_EXAMPLES.map(({ name, desc, cmd }) => (
              <button
                key={name}
                onClick={() => onSelectCommand(cmd)}
                className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
              >
                <code className="text-xs font-mono text-red-400 font-medium">{name}</code>
                <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
                <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded">
                  {cmd}
                </code>
              </button>
            ))}
          </>
        ) : (
          // Commands list
          commands.map(({ cmd, args, desc, example }) => (
            <button
              key={cmd}
              onClick={() => onSelectCommand(example || cmd + (args ? " " : ""))}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono text-red-400 font-medium">{cmd}</code>
                {args && (
                  <code className="text-xs font-mono text-text-tertiary">{args}</code>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
              {example && (
                <code className="text-xs font-mono text-text-tertiary mt-1 block bg-bg-tertiary px-2 py-1 rounded truncate">
                  {example}
                </code>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// History Panel
function HistoryPanel({
  history,
  onSelectQuery,
  onClearHistory,
}: {
  history: QueryHistoryEntry[];
  onSelectQuery: (sql: string) => void;
  onClearHistory: () => void;
}) {
  const sortedHistory = [...history].reverse();

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-primary flex items-center gap-2">
          <History className="w-3 h-3" />
          Command History
        </h3>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-red-500 transition-colors"
            title="Clear history"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedHistory.length === 0 ? (
          <div className="p-4 text-center text-text-tertiary text-xs">
            No command history yet
          </div>
        ) : (
          sortedHistory.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectQuery(entry.sql)}
              className="w-full px-3 py-2 text-left hover:bg-bg-hover border-b border-border/50 transition-colors"
            >
              <code className="text-xs font-mono text-text-primary line-clamp-2">
                {entry.sql}
              </code>
              <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                <span
                  className={entry.success ? "text-green-500" : "text-red-500"}
                >
                  {entry.success ? "✓" : "✗"}
                </span>
                <span>{entry.duration}ms</span>
                <span>•</span>
                <span>{new Date(entry.executedAt).toLocaleTimeString()}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default RedisQueryView;
