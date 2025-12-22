// Sample data for MongoDB development

// Switch to the application database
db = db.getSiblingDB('dbview_dev');

// Create collections with sample data

// Users collection
db.users.insertMany([
  {
    email: 'alice@example.com',
    name: 'Alice Johnson',
    role: 'admin',
    isActive: true,
    metadata: { department: 'Engineering', level: 5 },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    email: 'bob@example.com',
    name: 'Bob Smith',
    role: 'user',
    isActive: true,
    metadata: { department: 'Sales', level: 2 },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    email: 'carol@example.com',
    name: 'Carol Williams',
    role: 'user',
    isActive: true,
    metadata: { department: 'Marketing', level: 3 },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    email: 'david@example.com',
    name: 'David Brown',
    role: 'moderator',
    isActive: true,
    metadata: { department: 'Support', level: 4 },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    email: 'eve@example.com',
    name: 'Eve Davis',
    role: 'user',
    isActive: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Products collection
db.products.insertMany([
  {
    sku: 'LAPTOP-001',
    name: 'Pro Laptop 15"',
    description: 'High-performance laptop for professionals',
    price: 1299.99,
    quantity: 50,
    category: 'Electronics',
    tags: ['laptop', 'computer', 'work'],
    isAvailable: true,
    createdAt: new Date()
  },
  {
    sku: 'MOUSE-001',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse',
    price: 49.99,
    quantity: 200,
    category: 'Accessories',
    tags: ['mouse', 'wireless', 'ergonomic'],
    isAvailable: true,
    createdAt: new Date()
  },
  {
    sku: 'KEYBOARD-001',
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard',
    price: 129.99,
    quantity: 75,
    category: 'Accessories',
    tags: ['keyboard', 'mechanical', 'rgb'],
    isAvailable: true,
    createdAt: new Date()
  },
  {
    sku: 'MONITOR-001',
    name: '27" 4K Monitor',
    description: 'Ultra HD monitor with HDR',
    price: 449.99,
    quantity: 30,
    category: 'Electronics',
    tags: ['monitor', '4k', 'display'],
    isAvailable: true,
    createdAt: new Date()
  },
  {
    sku: 'HEADSET-001',
    name: 'Noise Cancelling Headset',
    description: 'Premium wireless headset',
    price: 199.99,
    quantity: 100,
    category: 'Audio',
    tags: ['headset', 'wireless', 'noise-cancelling'],
    isAvailable: true,
    createdAt: new Date()
  }
]);

// Orders collection
db.orders.insertMany([
  {
    userId: db.users.findOne({ email: 'alice@example.com' })._id,
    status: 'completed',
    totalAmount: 1349.98,
    shippingAddress: { street: '123 Main St', city: 'Seattle', zip: '98101' },
    items: [
      { sku: 'LAPTOP-001', name: 'Pro Laptop 15"', quantity: 1, unitPrice: 1299.99 },
      { sku: 'MOUSE-001', name: 'Wireless Mouse', quantity: 1, unitPrice: 49.99 }
    ],
    notes: null,
    orderedAt: new Date()
  },
  {
    userId: db.users.findOne({ email: 'bob@example.com' })._id,
    status: 'pending',
    totalAmount: 179.98,
    shippingAddress: { street: '456 Oak Ave', city: 'Portland', zip: '97201' },
    items: [
      { sku: 'KEYBOARD-001', name: 'Mechanical Keyboard', quantity: 1, unitPrice: 129.99 },
      { sku: 'MOUSE-001', name: 'Wireless Mouse', quantity: 1, unitPrice: 49.99 }
    ],
    notes: 'Gift wrap please',
    orderedAt: new Date()
  },
  {
    userId: db.users.findOne({ email: 'alice@example.com' })._id,
    status: 'shipped',
    totalAmount: 449.99,
    shippingAddress: { street: '123 Main St', city: 'Seattle', zip: '98101' },
    items: [
      { sku: 'MONITOR-001', name: '27" 4K Monitor', quantity: 1, unitPrice: 449.99 }
    ],
    notes: null,
    orderedAt: new Date()
  }
]);

// Analytics events collection
db.events.insertMany([
  {
    eventType: 'page_view',
    userId: db.users.findOne({ email: 'alice@example.com' })._id,
    payload: { page: '/products', duration: 45 },
    occurredAt: new Date()
  },
  {
    eventType: 'add_to_cart',
    userId: db.users.findOne({ email: 'alice@example.com' })._id,
    payload: { productSku: 'LAPTOP-001', quantity: 1 },
    occurredAt: new Date()
  },
  {
    eventType: 'purchase',
    userId: db.users.findOne({ email: 'alice@example.com' })._id,
    payload: { orderId: db.orders.findOne({ status: 'completed' })._id, amount: 1349.98 },
    occurredAt: new Date()
  },
  {
    eventType: 'page_view',
    userId: db.users.findOne({ email: 'bob@example.com' })._id,
    payload: { page: '/home', duration: 12 },
    occurredAt: new Date()
  },
  {
    eventType: 'signup',
    userId: db.users.findOne({ email: 'eve@example.com' })._id,
    payload: { source: 'google', campaign: 'summer2024' },
    occurredAt: new Date()
  }
]);

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ category: 1 });
db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ status: 1 });
db.events.createIndex({ eventType: 1 });
db.events.createIndex({ userId: 1 });

print('MongoDB initialization complete!');
