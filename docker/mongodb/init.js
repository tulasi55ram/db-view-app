// MongoDB Initialization Script

// Connect to dbview database
db = db.getSiblingDB('dbview_dev');

// Create users collection
db.createCollection('users');

// Insert sample named users
db.users.insertMany([
  {
    email: 'alice@example.com',
    name: 'Alice Johnson',
    role: 'admin',
    isActive: true,
    metadata: { department: 'Engineering', level: 5 },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  },
  {
    email: 'bob@example.com',
    name: 'Bob Smith',
    role: 'user',
    isActive: true,
    metadata: { department: 'Sales', level: 2 },
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date()
  },
  {
    email: 'carol@example.com',
    name: 'Carol Williams',
    role: 'user',
    isActive: true,
    metadata: { department: 'Marketing', level: 3 },
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date()
  },
  {
    email: 'david@example.com',
    name: 'David Brown',
    role: 'moderator',
    isActive: false,
    metadata: { department: 'Support', level: 4 },
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date()
  },
  {
    email: 'eve@example.com',
    name: 'Eve Davis',
    role: 'user',
    isActive: true,
    metadata: null,
    createdAt: new Date('2024-04-05'),
    updatedAt: new Date()
  }
]);

// Generate 10000 additional users
print('Generating 10000 additional users...');

var firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Barbara',
  'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Timothy', 'Deborah'];

var lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];

var departments = ['Engineering', 'Sales', 'Marketing', 'Support', 'HR', 'Finance', 'Operations', 'Design', 'Product', 'QA'];
var roles = ['user', 'user', 'user', 'user', 'moderator', 'admin'];

var batchSize = 1000;
var totalUsers = 10000;

for (var batch = 0; batch < totalUsers / batchSize; batch++) {
  var users = [];
  for (var j = 0; j < batchSize; j++) {
    var i = batch * batchSize + j + 1;
    var firstName = firstNames[i % 50];
    var lastName = lastNames[i % 50];
    var role = roles[i % 6];
    var dept = departments[i % 10];
    var level = 1 + (i % 5);
    var isActive = (i % 10) !== 0;

    users.push({
      email: 'user' + i + '@example.com',
      name: firstName + ' ' + lastName,
      role: role,
      isActive: isActive,
      metadata: { department: dept, level: level },
      createdAt: new Date(2020, 0, 1 + (i % 1000)),
      updatedAt: new Date()
    });
  }
  db.users.insertMany(users);
  print('Inserted batch ' + (batch + 1) + ' of ' + (totalUsers / batchSize));
}

// Create products collection
db.createCollection('products');

// Insert sample products
db.products.insertMany([
  {
    sku: 'LAPTOP-001',
    name: 'Pro Laptop 15"',
    description: 'High-performance laptop for professionals',
    price: 1299.99,
    quantity: 50,
    category: 'Electronics',
    isAvailable: true,
    tags: ['laptop', 'professional', 'high-performance'],
    createdAt: new Date('2024-01-01')
  },
  {
    sku: 'MOUSE-001',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse',
    price: 49.99,
    quantity: 200,
    category: 'Accessories',
    isAvailable: true,
    tags: ['mouse', 'wireless', 'ergonomic'],
    createdAt: new Date('2024-01-05')
  },
  {
    sku: 'KEYBOARD-001',
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard',
    price: 129.99,
    quantity: 75,
    category: 'Accessories',
    isAvailable: true,
    tags: ['keyboard', 'mechanical', 'rgb'],
    createdAt: new Date('2024-01-10')
  },
  {
    sku: 'MONITOR-001',
    name: '27" 4K Monitor',
    description: 'Ultra HD monitor with HDR',
    price: 449.99,
    quantity: 30,
    category: 'Electronics',
    isAvailable: true,
    tags: ['monitor', '4k', 'hdr'],
    createdAt: new Date('2024-01-15')
  },
  {
    sku: 'HEADSET-001',
    name: 'Noise Cancelling Headset',
    description: 'Premium wireless headset',
    price: 199.99,
    quantity: 100,
    category: 'Audio',
    isAvailable: true,
    tags: ['headset', 'wireless', 'noise-cancelling'],
    createdAt: new Date('2024-01-20')
  }
]);

// Create orders collection
db.createCollection('orders');

// Insert sample orders with references
var aliceId = db.users.findOne({ email: 'alice@example.com' })._id;
var bobId = db.users.findOne({ email: 'bob@example.com' })._id;
var carolId = db.users.findOne({ email: 'carol@example.com' })._id;
var laptopId = db.products.findOne({ sku: 'LAPTOP-001' })._id;
var mouseId = db.products.findOne({ sku: 'MOUSE-001' })._id;
var keyboardId = db.products.findOne({ sku: 'KEYBOARD-001' })._id;
var monitorId = db.products.findOne({ sku: 'MONITOR-001' })._id;

db.orders.insertMany([
  {
    userId: aliceId,
    status: 'completed',
    totalAmount: 1349.98,
    items: [
      { productId: laptopId, quantity: 1, unitPrice: 1299.99 },
      { productId: mouseId, quantity: 1, unitPrice: 49.99 }
    ],
    shippingAddress: {
      street: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    },
    orderedAt: new Date('2024-02-01')
  },
  {
    userId: bobId,
    status: 'pending',
    totalAmount: 179.98,
    items: [
      { productId: keyboardId, quantity: 1, unitPrice: 129.99 },
      { productId: mouseId, quantity: 1, unitPrice: 49.99 }
    ],
    shippingAddress: {
      street: '456 Oak Ave',
      city: 'Portland',
      state: 'OR',
      zip: '97201'
    },
    notes: 'Gift wrap please',
    orderedAt: new Date('2024-02-15')
  },
  {
    userId: aliceId,
    status: 'shipped',
    totalAmount: 449.99,
    items: [
      { productId: monitorId, quantity: 1, unitPrice: 449.99 }
    ],
    shippingAddress: {
      street: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    },
    orderedAt: new Date('2024-03-01')
  },
  {
    userId: carolId,
    status: 'completed',
    totalAmount: 49.99,
    items: [
      { productId: mouseId, quantity: 1, unitPrice: 49.99 }
    ],
    shippingAddress: {
      street: '789 Pine Rd',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102'
    },
    orderedAt: new Date('2024-03-15')
  }
]);

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ category: 1 });
db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ status: 1 });

// Create a view
db.createView('user_order_summary', 'users', [
  {
    $lookup: {
      from: 'orders',
      localField: '_id',
      foreignField: 'userId',
      as: 'orders'
    }
  },
  {
    $project: {
      _id: 1,
      name: 1,
      email: 1,
      totalOrders: { $size: '$orders' },
      lifetimeValue: { $sum: '$orders.totalAmount' }
    }
  }
]);

print('MongoDB database initialized successfully!');
print('Collections created: users (' + db.users.countDocuments() + ' docs - including 10000 generated), products (' + db.products.countDocuments() + ' docs), orders (' + db.orders.countDocuments() + ' docs)');
print('View created: user_order_summary');
