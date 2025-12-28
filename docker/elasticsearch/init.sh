#!/bin/sh
# Elasticsearch Initialization Script
# Seeds sample data for dbview testing

ES_HOST="http://elasticsearch:9200"
AUTH="elastic:dbview123"

echo "Waiting for Elasticsearch to be ready..."
sleep 5

echo "Creating indices and seeding data..."

# ============================================
# Create Users Index with Mapping
# ============================================
echo "Creating users index..."
curl -s -X PUT "$ES_HOST/users" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "email": { "type": "keyword" },
        "name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
        "role": { "type": "keyword" },
        "isActive": { "type": "boolean" },
        "department": { "type": "keyword" },
        "level": { "type": "integer" },
        "skills": { "type": "keyword" },
        "createdAt": { "type": "date" },
        "updatedAt": { "type": "date" }
      }
    }
  }'
echo ""

# Insert users
echo "Inserting users..."
curl -s -X POST "$ES_HOST/users/_doc/1" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "email": "alice@example.com",
  "name": "Alice Johnson",
  "role": "admin",
  "isActive": true,
  "department": "Engineering",
  "level": 5,
  "skills": ["javascript", "python", "elasticsearch"],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-12-01T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/users/_doc/2" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "email": "bob@example.com",
  "name": "Bob Smith",
  "role": "user",
  "isActive": true,
  "department": "Sales",
  "level": 2,
  "skills": ["salesforce", "excel"],
  "createdAt": "2024-02-20T10:00:00Z",
  "updatedAt": "2024-11-15T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/users/_doc/3" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "email": "carol@example.com",
  "name": "Carol Williams",
  "role": "user",
  "isActive": true,
  "department": "Marketing",
  "level": 3,
  "skills": ["analytics", "seo", "content"],
  "createdAt": "2024-03-10T10:00:00Z",
  "updatedAt": "2024-10-20T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/users/_doc/4" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "email": "david@example.com",
  "name": "David Brown",
  "role": "moderator",
  "isActive": false,
  "department": "Support",
  "level": 4,
  "skills": ["customer-service", "jira"],
  "createdAt": "2024-01-25T10:00:00Z",
  "updatedAt": "2024-09-01T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/users/_doc/5" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "email": "eve@example.com",
  "name": "Eve Davis",
  "role": "user",
  "isActive": true,
  "department": "Engineering",
  "level": 3,
  "skills": ["java", "spring", "kubernetes"],
  "createdAt": "2024-04-05T10:00:00Z",
  "updatedAt": "2024-12-10T10:00:00Z"
}'
echo ""

# ============================================
# Create Products Index with Mapping
# ============================================
echo "Creating products index..."
curl -s -X PUT "$ES_HOST/products" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "sku": { "type": "keyword" },
        "name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
        "description": { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } } },
        "price": { "type": "float" },
        "quantity": { "type": "integer" },
        "category": { "type": "keyword" },
        "isAvailable": { "type": "boolean" },
        "tags": { "type": "keyword" },
        "rating": { "type": "float" },
        "reviews": { "type": "integer" },
        "createdAt": { "type": "date" }
      }
    }
  }'
echo ""

# Insert products
echo "Inserting products..."
curl -s -X POST "$ES_HOST/products/_doc/1" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "sku": "LAPTOP-001",
  "name": "Pro Laptop 15\"",
  "description": "High-performance laptop for professionals with Intel i9 processor and 32GB RAM",
  "price": 1299.99,
  "quantity": 50,
  "category": "Electronics",
  "isAvailable": true,
  "tags": ["laptop", "professional", "high-performance", "intel"],
  "rating": 4.7,
  "reviews": 245,
  "createdAt": "2024-01-01T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/products/_doc/2" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "sku": "MOUSE-001",
  "name": "Wireless Ergonomic Mouse",
  "description": "Ergonomic wireless mouse with adjustable DPI and silent clicks",
  "price": 49.99,
  "quantity": 200,
  "category": "Accessories",
  "isAvailable": true,
  "tags": ["mouse", "wireless", "ergonomic"],
  "rating": 4.5,
  "reviews": 1023,
  "createdAt": "2024-01-05T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/products/_doc/3" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "sku": "KEYBOARD-001",
  "name": "Mechanical Gaming Keyboard",
  "description": "RGB mechanical keyboard with Cherry MX switches",
  "price": 129.99,
  "quantity": 75,
  "category": "Accessories",
  "isAvailable": true,
  "tags": ["keyboard", "mechanical", "rgb", "gaming"],
  "rating": 4.8,
  "reviews": 567,
  "createdAt": "2024-01-10T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/products/_doc/4" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "sku": "MONITOR-001",
  "name": "27\" 4K UltraSharp Monitor",
  "description": "Ultra HD IPS monitor with HDR support and USB-C connectivity",
  "price": 449.99,
  "quantity": 30,
  "category": "Electronics",
  "isAvailable": true,
  "tags": ["monitor", "4k", "hdr", "usb-c"],
  "rating": 4.6,
  "reviews": 312,
  "createdAt": "2024-01-15T10:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/products/_doc/5" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "sku": "HEADSET-001",
  "name": "Pro Noise Cancelling Headset",
  "description": "Premium wireless headset with active noise cancellation and 30hr battery",
  "price": 199.99,
  "quantity": 100,
  "category": "Audio",
  "isAvailable": true,
  "tags": ["headset", "wireless", "noise-cancelling", "premium"],
  "rating": 4.9,
  "reviews": 892,
  "createdAt": "2024-01-20T10:00:00Z"
}'
echo ""

# ============================================
# Create Orders Index with Mapping
# ============================================
echo "Creating orders index..."
curl -s -X PUT "$ES_HOST/orders" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "orderId": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "userEmail": { "type": "keyword" },
        "status": { "type": "keyword" },
        "totalAmount": { "type": "float" },
        "itemCount": { "type": "integer" },
        "items": {
          "type": "nested",
          "properties": {
            "productSku": { "type": "keyword" },
            "productName": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
            "quantity": { "type": "integer" },
            "unitPrice": { "type": "float" }
          }
        },
        "shippingAddress": {
          "properties": {
            "street": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
            "city": { "type": "keyword" },
            "state": { "type": "keyword" },
            "zip": { "type": "keyword" },
            "country": { "type": "keyword" }
          }
        },
        "paymentMethod": { "type": "keyword" },
        "notes": { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } } },
        "orderedAt": { "type": "date" },
        "shippedAt": { "type": "date" },
        "deliveredAt": { "type": "date" }
      }
    }
  }'
echo ""

# Insert orders
echo "Inserting orders..."
curl -s -X POST "$ES_HOST/orders/_doc/1" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "orderId": "ORD-2024-001",
  "userId": "1",
  "userEmail": "alice@example.com",
  "status": "delivered",
  "totalAmount": 1349.98,
  "itemCount": 2,
  "items": [
    { "productSku": "LAPTOP-001", "productName": "Pro Laptop 15\"", "quantity": 1, "unitPrice": 1299.99 },
    { "productSku": "MOUSE-001", "productName": "Wireless Ergonomic Mouse", "quantity": 1, "unitPrice": 49.99 }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA"
  },
  "paymentMethod": "credit_card",
  "orderedAt": "2024-02-01T14:30:00Z",
  "shippedAt": "2024-02-02T09:00:00Z",
  "deliveredAt": "2024-02-05T15:45:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/orders/_doc/2" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "orderId": "ORD-2024-002",
  "userId": "2",
  "userEmail": "bob@example.com",
  "status": "processing",
  "totalAmount": 179.98,
  "itemCount": 2,
  "items": [
    { "productSku": "KEYBOARD-001", "productName": "Mechanical Gaming Keyboard", "quantity": 1, "unitPrice": 129.99 },
    { "productSku": "MOUSE-001", "productName": "Wireless Ergonomic Mouse", "quantity": 1, "unitPrice": 49.99 }
  ],
  "shippingAddress": {
    "street": "456 Oak Ave",
    "city": "Portland",
    "state": "OR",
    "zip": "97201",
    "country": "USA"
  },
  "paymentMethod": "paypal",
  "notes": "Please gift wrap",
  "orderedAt": "2024-02-15T10:15:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/orders/_doc/3" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "orderId": "ORD-2024-003",
  "userId": "1",
  "userEmail": "alice@example.com",
  "status": "shipped",
  "totalAmount": 449.99,
  "itemCount": 1,
  "items": [
    { "productSku": "MONITOR-001", "productName": "27\" 4K UltraSharp Monitor", "quantity": 1, "unitPrice": 449.99 }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101",
    "country": "USA"
  },
  "paymentMethod": "credit_card",
  "orderedAt": "2024-03-01T16:45:00Z",
  "shippedAt": "2024-03-02T11:00:00Z"
}'
echo ""

curl -s -X POST "$ES_HOST/orders/_doc/4" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "orderId": "ORD-2024-004",
  "userId": "3",
  "userEmail": "carol@example.com",
  "status": "delivered",
  "totalAmount": 249.98,
  "itemCount": 2,
  "items": [
    { "productSku": "HEADSET-001", "productName": "Pro Noise Cancelling Headset", "quantity": 1, "unitPrice": 199.99 },
    { "productSku": "MOUSE-001", "productName": "Wireless Ergonomic Mouse", "quantity": 1, "unitPrice": 49.99 }
  ],
  "shippingAddress": {
    "street": "789 Pine Rd",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "USA"
  },
  "paymentMethod": "apple_pay",
  "orderedAt": "2024-03-15T09:30:00Z",
  "shippedAt": "2024-03-16T08:00:00Z",
  "deliveredAt": "2024-03-18T14:20:00Z"
}'
echo ""

# ============================================
# Create Application Logs Index (Elasticsearch common use case)
# ============================================
echo "Creating logs index..."
curl -s -X PUT "$ES_HOST/app-logs" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "service": { "type": "keyword" },
        "message": { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } } },
        "traceId": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "requestPath": { "type": "keyword" },
        "responseTime": { "type": "integer" },
        "statusCode": { "type": "integer" },
        "userAgent": { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } } },
        "ip": { "type": "ip" }
      }
    }
  }'
echo ""

# Insert sample logs
echo "Inserting application logs..."
curl -s -X POST "$ES_HOST/app-logs/_doc/1" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "timestamp": "2024-12-28T10:00:00Z",
  "level": "INFO",
  "service": "api-gateway",
  "message": "User login successful",
  "traceId": "abc123def456",
  "userId": "1",
  "requestPath": "/api/auth/login",
  "responseTime": 145,
  "statusCode": 200,
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "ip": "192.168.1.100"
}'
echo ""

curl -s -X POST "$ES_HOST/app-logs/_doc/2" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "timestamp": "2024-12-28T10:01:15Z",
  "level": "INFO",
  "service": "order-service",
  "message": "Order created successfully",
  "traceId": "xyz789abc012",
  "userId": "2",
  "requestPath": "/api/orders",
  "responseTime": 234,
  "statusCode": 201,
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "ip": "192.168.1.101"
}'
echo ""

curl -s -X POST "$ES_HOST/app-logs/_doc/3" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "timestamp": "2024-12-28T10:02:30Z",
  "level": "ERROR",
  "service": "payment-service",
  "message": "Payment processing failed: Card declined",
  "traceId": "err456xyz789",
  "userId": "3",
  "requestPath": "/api/payments/process",
  "responseTime": 1523,
  "statusCode": 400,
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
  "ip": "192.168.1.102"
}'
echo ""

curl -s -X POST "$ES_HOST/app-logs/_doc/4" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "timestamp": "2024-12-28T10:03:45Z",
  "level": "WARN",
  "service": "inventory-service",
  "message": "Low stock alert: Product LAPTOP-001 has only 5 units left",
  "traceId": "warn123abc456",
  "requestPath": "/api/inventory/check",
  "responseTime": 89,
  "statusCode": 200,
  "ip": "10.0.0.50"
}'
echo ""

curl -s -X POST "$ES_HOST/app-logs/_doc/5" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "timestamp": "2024-12-28T10:05:00Z",
  "level": "DEBUG",
  "service": "search-service",
  "message": "Elasticsearch query executed: {\"match\": {\"name\": \"laptop\"}}",
  "traceId": "debug789xyz012",
  "userId": "1",
  "requestPath": "/api/products/search",
  "responseTime": 45,
  "statusCode": 200,
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "ip": "192.168.1.100"
}'
echo ""

curl -s -X POST "$ES_HOST/app-logs/_doc/6" -u "$AUTH" -H "Content-Type: application/json" -d '{
  "timestamp": "2024-12-28T10:06:20Z",
  "level": "INFO",
  "service": "notification-service",
  "message": "Email notification sent to user",
  "traceId": "notif456abc789",
  "userId": "2",
  "requestPath": "/api/notifications/email",
  "responseTime": 312,
  "statusCode": 200,
  "ip": "10.0.0.51"
}'
echo ""

# Refresh indices to make documents searchable immediately
echo "Refreshing indices..."
curl -s -X POST "$ES_HOST/_refresh" -u "$AUTH"
echo ""

# Display summary
echo ""
echo "============================================"
echo "Elasticsearch initialization complete!"
echo "============================================"
echo ""
echo "Indices created:"
curl -s "$ES_HOST/_cat/indices?v" -u "$AUTH"
echo ""
echo "Connection details:"
echo "  Host: localhost:9200"
echo "  Username: elastic"
echo "  Password: dbview123"
echo ""
echo "Sample Query DSL (test in QueryView):"
echo '  {"index": "products", "query": {"match": {"description": "laptop"}}}'
echo ""
