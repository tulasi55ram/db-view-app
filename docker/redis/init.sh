#!/bin/bash
# Redis initialization script - creates sample data for ALL Redis types

# Wait for Redis to be ready
sleep 2

echo "Initializing Redis sample data for all data types..."

# ============================================
# HASH type - Multi-field records
# ============================================
echo "Creating HASH data..."

# Sample user hashes
redis-cli -a redis123 HSET user:1 name "Alice Johnson" email "alice@example.com" role "admin" created_at "2024-01-15"
redis-cli -a redis123 HSET user:2 name "Bob Smith" email "bob@example.com" role "user" created_at "2024-02-20"
redis-cli -a redis123 HSET user:3 name "Charlie Brown" email "charlie@example.com" role "user" created_at "2024-03-10"

# Sample product hashes
redis-cli -a redis123 HSET product:1 name "Laptop" price "999.99" stock "50" category "Electronics"
redis-cli -a redis123 HSET product:2 name "Keyboard" price "79.99" stock "150" category "Electronics"
redis-cli -a redis123 HSET product:3 name "Mouse" price "29.99" stock "200" category "Electronics"
redis-cli -a redis123 HSET product:4 name "Monitor" price "349.99" stock "75" category "Electronics"

# Sample order hashes
redis-cli -a redis123 HSET order:1001 user_id "1" total "1079.98" status "completed" date "2024-06-01"
redis-cli -a redis123 HSET order:1002 user_id "2" total "29.99" status "shipped" date "2024-06-05"
redis-cli -a redis123 HSET order:1003 user_id "1" total "349.99" status "pending" date "2024-06-10"

# Sample session hashes
redis-cli -a redis123 HSET session:abc123 user_id "1" ip "192.168.1.100" user_agent "Mozilla/5.0" expires_at "2024-12-31"
redis-cli -a redis123 HSET session:def456 user_id "2" ip "192.168.1.101" user_agent "Chrome/120" expires_at "2024-12-31"

# Config hash (single key, many fields)
redis-cli -a redis123 HSET config:app theme "dark" language "en" timezone "UTC" max_connections "100"

# ============================================
# STRING type - Simple key-value pairs
# ============================================
echo "Creating STRING data..."

# Cache entries
redis-cli -a redis123 SET cache:homepage "<html>...</html>"
redis-cli -a redis123 SET cache:api:users "[{\"id\":1,\"name\":\"Alice\"}]"
redis-cli -a redis123 SET cache:api:products "[{\"id\":1,\"name\":\"Laptop\"}]"

# Counter strings
redis-cli -a redis123 SET counter:visitors "1543"
redis-cli -a redis123 SET counter:orders "287"
redis-cli -a redis123 SET counter:errors "12"

# Settings strings
redis-cli -a redis123 SET setting:maintenance "false"
redis-cli -a redis123 SET setting:version "2.1.0"
redis-cli -a redis123 SET setting:last_backup "2024-12-20T10:30:00Z"

# ============================================
# LIST type - Ordered sequences
# ============================================
echo "Creating LIST data..."

# Recent activity logs
redis-cli -a redis123 RPUSH log:activity "User alice logged in" "User bob updated profile" "Order #1001 created" "Payment processed" "User charlie signed up"

# Task queues
redis-cli -a redis123 RPUSH queue:emails "send_welcome:user:3" "send_invoice:order:1001" "send_reminder:user:1"
redis-cli -a redis123 RPUSH queue:notifications "push:user:1:new_order" "push:user:2:shipment" "sms:user:3:verification"

# Recent viewed items
redis-cli -a redis123 RPUSH recent:user:1 "product:1" "product:3" "product:2" "product:4"
redis-cli -a redis123 RPUSH recent:user:2 "product:2" "product:1"

# ============================================
# SET type - Unique collections
# ============================================
echo "Creating SET data..."

# User tags/interests
redis-cli -a redis123 SADD tags:user:1 "technology" "gaming" "music" "travel"
redis-cli -a redis123 SADD tags:user:2 "sports" "cooking" "photography"
redis-cli -a redis123 SADD tags:user:3 "books" "technology" "art"

# Online users
redis-cli -a redis123 SADD online:users "user:1" "user:3" "user:5" "user:8"

# Product categories
redis-cli -a redis123 SADD category:electronics "product:1" "product:2" "product:3" "product:4"
redis-cli -a redis123 SADD category:bestsellers "product:1" "product:3"

# Blocked IPs
redis-cli -a redis123 SADD blocked:ips "192.168.1.50" "10.0.0.100" "172.16.0.25"

# ============================================
# ZSET (Sorted Set) type - Scored rankings
# ============================================
echo "Creating ZSET data..."

# Leaderboard scores
redis-cli -a redis123 ZADD leaderboard:game 15000 "alice" 12500 "bob" 11000 "charlie" 9500 "david" 8000 "eve"

# Product ratings (score = rating * 100 for precision)
redis-cli -a redis123 ZADD rating:products 485 "product:1" 420 "product:2" 395 "product:3" 450 "product:4"

# Search ranking by relevance score
redis-cli -a redis123 ZADD search:laptop 100 "product:1" 85 "product:4" 45 "product:2"

# Article views (score = view count)
redis-cli -a redis123 ZADD views:articles 5420 "article:101" 3200 "article:102" 2800 "article:103" 1500 "article:104"

# Scheduled tasks (score = unix timestamp)
redis-cli -a redis123 ZADD scheduled:tasks 1735084800 "backup:db" 1735171200 "cleanup:logs" 1735257600 "report:weekly"

# ============================================
# STREAM type - Event log entries
# ============================================
echo "Creating STREAM data..."

# Order events stream
redis-cli -a redis123 XADD events:orders "*" action "created" order_id "1001" user_id "1" total "1079.98"
redis-cli -a redis123 XADD events:orders "*" action "paid" order_id "1001" payment_method "credit_card"
redis-cli -a redis123 XADD events:orders "*" action "shipped" order_id "1001" tracking "TRK123456"
redis-cli -a redis123 XADD events:orders "*" action "created" order_id "1002" user_id "2" total "29.99"
redis-cli -a redis123 XADD events:orders "*" action "paid" order_id "1002" payment_method "paypal"

# User activity stream
redis-cli -a redis123 XADD stream:activity "*" user "alice" action "login" ip "192.168.1.100"
redis-cli -a redis123 XADD stream:activity "*" user "alice" action "view_product" product_id "1"
redis-cli -a redis123 XADD stream:activity "*" user "bob" action "login" ip "192.168.1.101"
redis-cli -a redis123 XADD stream:activity "*" user "alice" action "add_to_cart" product_id "1" quantity "1"
redis-cli -a redis123 XADD stream:activity "*" user "alice" action "checkout" order_id "1003"

# System metrics stream
redis-cli -a redis123 XADD metrics:system "*" cpu "45.2" memory "62.8" disk "35.1" connections "127"
redis-cli -a redis123 XADD metrics:system "*" cpu "48.1" memory "63.2" disk "35.1" connections "132"
redis-cli -a redis123 XADD metrics:system "*" cpu "42.7" memory "61.5" disk "35.2" connections "125"

echo ""
echo "============================================"
echo "Redis sample data initialized successfully!"
echo "============================================"
echo ""
echo "Data types created:"
echo "  - HASH:   user:*, product:*, order:*, session:*, config:*"
echo "  - STRING: cache:*, counter:*, setting:*"
echo "  - LIST:   log:*, queue:*, recent:*"
echo "  - SET:    tags:*, online:*, category:*, blocked:*"
echo "  - ZSET:   leaderboard:*, rating:*, search:*, views:*, scheduled:*"
echo "  - STREAM: events:*, stream:*, metrics:*"
echo ""
