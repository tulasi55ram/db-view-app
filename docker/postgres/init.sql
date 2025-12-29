-- Comprehensive PostgreSQL Database for DBView Testing
-- This file creates multiple schemas with diverse table structures and data types

-- ============================================================================
-- CREATE SCHEMAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS cms;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ============================================================================
-- PUBLIC SCHEMA TABLES
-- ============================================================================

-- Users table with diverse column types
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator', 'guest')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    age SMALLINT CHECK (age >= 0 AND age <= 150),
    salary NUMERIC(10, 2),
    bonus_percentage REAL DEFAULT 0.0,
    profile_picture BYTEA,
    bio TEXT,
    website_url VARCHAR(500),
    phone_number VARCHAR(20),
    ip_address INET,
    metadata JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{"theme": "light", "notifications": true}',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    birth_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Orders table
CREATE TABLE public.orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    shipping_address JSONB,
    billing_address JSONB,
    notes TEXT,
    tracking_number VARCHAR(100),
    estimated_delivery DATE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE public.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    product_name VARCHAR(200) NOT NULL,
    sku VARCHAR(50),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    discount DECIMAL(10, 2) DEFAULT 0.00,
    tax DECIMAL(10, 2) DEFAULT 0.00,
    subtotal DECIMAL(10, 2) NOT NULL,
    attributes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE public.sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INVENTORY SCHEMA TABLES
-- ============================================================================

-- Categories table
CREATE TABLE inventory.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES inventory.categories(id),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table with extensive columns
CREATE TABLE inventory.products (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    category_id INTEGER REFERENCES inventory.categories(id),
    brand VARCHAR(100),
    manufacturer VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    cost DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),
    discount_percentage REAL DEFAULT 0.0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    reorder_quantity INTEGER DEFAULT 50,
    weight NUMERIC(10, 3), -- in kg
    dimensions JSONB, -- {width, height, depth} in cm
    volume NUMERIC(10, 3), -- in cubic meters
    color VARCHAR(50),
    size VARCHAR(20),
    material VARCHAR(100),
    country_of_origin VARCHAR(100),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    attributes JSONB DEFAULT '{}',
    images JSONB DEFAULT '[]', -- array of image URLs
    rating REAL DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    discontinued_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouses table
CREATE TABLE inventory.warehouses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address JSONB NOT NULL,
    manager_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    opened_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movements table
CREATE TABLE inventory.stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES inventory.products(id),
    warehouse_id INTEGER REFERENCES inventory.warehouses(id),
    movement_type VARCHAR(20) CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer', 'return')),
    quantity INTEGER NOT NULL,
    reference_number VARCHAR(100),
    reason TEXT,
    notes TEXT,
    performed_by INTEGER REFERENCES public.users(id),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- HR SCHEMA TABLES
-- ============================================================================

-- Departments table
CREATE TABLE hr.departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    manager_id INTEGER,
    parent_department_id INTEGER REFERENCES hr.departments(id),
    budget DECIMAL(15, 2),
    head_count INTEGER DEFAULT 0,
    location VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    established_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table
CREATE TABLE hr.employees (
    id SERIAL PRIMARY KEY,
    employee_number VARCHAR(20) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES public.users(id),
    department_id INTEGER REFERENCES hr.departments(id),
    manager_id INTEGER REFERENCES hr.employees(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    job_title VARCHAR(100) NOT NULL,
    employment_type VARCHAR(20) CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'intern')),
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'on-leave', 'terminated', 'retired')),
    salary NUMERIC(12, 2) NOT NULL,
    hourly_rate NUMERIC(8, 2),
    commission_rate REAL,
    benefits JSONB,
    emergency_contact JSONB,
    address JSONB,
    date_of_birth DATE,
    hire_date DATE NOT NULL,
    termination_date DATE,
    probation_end_date DATE,
    last_promotion_date DATE,
    last_review_date DATE,
    next_review_date DATE,
    vacation_days_total SMALLINT DEFAULT 20,
    vacation_days_used SMALLINT DEFAULT 0,
    sick_days_used SMALLINT DEFAULT 0,
    performance_rating REAL CHECK (performance_rating >= 1 AND performance_rating <= 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for department manager
ALTER TABLE hr.departments ADD CONSTRAINT fk_department_manager
    FOREIGN KEY (manager_id) REFERENCES hr.employees(id);

-- Projects table
CREATE TABLE hr.projects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    department_id INTEGER REFERENCES hr.departments(id),
    project_manager_id INTEGER REFERENCES hr.employees(id),
    client_name VARCHAR(200),
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on-hold', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    budget DECIMAL(15, 2),
    actual_cost DECIMAL(15, 2) DEFAULT 0,
    estimated_hours INTEGER,
    actual_hours INTEGER DEFAULT 0,
    progress_percentage SMALLINT DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    start_date DATE,
    end_date DATE,
    actual_end_date DATE,
    tags TEXT[],
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE hr.tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES hr.projects(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES hr.employees(id),
    created_by INTEGER REFERENCES hr.employees(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'review', 'done', 'blocked')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_hours NUMERIC(6, 2),
    actual_hours NUMERIC(6, 2) DEFAULT 0,
    progress_percentage SMALLINT DEFAULT 0,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[],
    dependencies INTEGER[], -- array of task IDs
    attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time tracking table
CREATE TABLE hr.time_entries (
    id BIGSERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES hr.employees(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES hr.projects(id),
    task_id INTEGER REFERENCES hr.tasks(id),
    description TEXT,
    hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
    billable BOOLEAN DEFAULT true,
    hourly_rate NUMERIC(8, 2),
    entry_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_duration INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- FINANCE SCHEMA TABLES
-- ============================================================================

-- Customers table
CREATE TABLE finance.customers (
    id SERIAL PRIMARY KEY,
    customer_number VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(200),
    contact_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    mobile VARCHAR(20),
    website VARCHAR(200),
    tax_id VARCHAR(50),
    customer_type VARCHAR(20) CHECK (customer_type IN ('individual', 'business', 'government')),
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    payment_terms VARCHAR(50),
    billing_address JSONB,
    shipping_address JSONB,
    notes TEXT,
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
    is_active BOOLEAN DEFAULT true,
    total_purchases DECIMAL(15, 2) DEFAULT 0,
    total_outstanding DECIMAL(15, 2) DEFAULT 0,
    last_purchase_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE finance.invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES finance.customers(id),
    order_id INTEGER REFERENCES public.orders(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled')),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    amount_due DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    terms TEXT,
    payment_instructions TEXT,
    late_fee DECIMAL(10, 2) DEFAULT 0,
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20),
    next_invoice_date DATE,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice items table
CREATE TABLE finance.invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES finance.invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_percentage REAL DEFAULT 0,
    tax_percentage REAL DEFAULT 0,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE finance.payments (
    id SERIAL PRIMARY KEY,
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_id INTEGER REFERENCES finance.invoices(id),
    customer_id INTEGER REFERENCES finance.customers(id),
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'paypal', 'stripe')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    transaction_id VARCHAR(100),
    reference_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    notes TEXT,
    payment_date DATE NOT NULL,
    processed_by INTEGER REFERENCES public.users(id),
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE finance.expenses (
    id SERIAL PRIMARY KEY,
    expense_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id INTEGER REFERENCES hr.employees(id),
    project_id INTEGER REFERENCES hr.projects(id),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    vendor VARCHAR(200),
    receipt_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    billable BOOLEAN DEFAULT false,
    reimbursable BOOLEAN DEFAULT true,
    expense_date DATE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER REFERENCES hr.employees(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS SCHEMA TABLES
-- ============================================================================

-- Events table for analytics
CREATE TABLE analytics.events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID DEFAULT uuid_generate_v4() UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES public.users(id),
    session_id BIGINT REFERENCES public.sessions(id),
    properties JSONB DEFAULT '{}',
    page_url TEXT,
    referrer TEXT,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Page views table
CREATE TABLE analytics.page_views (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id),
    session_id BIGINT REFERENCES public.sessions(id),
    page_url TEXT NOT NULL,
    page_title VARCHAR(500),
    referrer TEXT,
    duration INTEGER, -- seconds
    scroll_depth SMALLINT, -- percentage
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User behavior metrics
CREATE TABLE analytics.user_metrics (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) UNIQUE,
    total_sessions INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(15, 2) DEFAULT 0,
    average_order_value DECIMAL(12, 2) DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    first_visit_at TIMESTAMP WITH TIME ZONE,
    last_visit_at TIMESTAMP WITH TIME ZONE,
    last_purchase_at TIMESTAMP WITH TIME ZONE,
    lifetime_value DECIMAL(15, 2) DEFAULT 0,
    engagement_score REAL DEFAULT 0,
    churn_risk_score REAL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CMS SCHEMA TABLES
-- ============================================================================

-- Blog posts table
CREATE TABLE cms.posts (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    title VARCHAR(300) NOT NULL,
    slug VARCHAR(300) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES public.users(id),
    category VARCHAR(100),
    tags TEXT[],
    featured_image VARCHAR(500),
    images JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'scheduled')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'password')),
    password_hash VARCHAR(255),
    seo_title VARCHAR(200),
    seo_description VARCHAR(500),
    seo_keywords TEXT[],
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    reading_time INTEGER, -- minutes
    is_featured BOOLEAN DEFAULT false,
    allow_comments BOOLEAN DEFAULT true,
    published_at TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table
CREATE TABLE cms.comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES cms.posts(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES cms.comments(id),
    user_id INTEGER REFERENCES public.users(id),
    author_name VARCHAR(100),
    author_email VARCHAR(255),
    content TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'spam', 'trash')),
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media library table
CREATE TABLE cms.media (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL, -- bytes
    width INTEGER,
    height INTEGER,
    duration INTEGER, -- for videos, in seconds
    title VARCHAR(300),
    alt_text VARCHAR(500),
    caption TEXT,
    description TEXT,
    uploaded_by INTEGER REFERENCES public.users(id),
    folder VARCHAR(200),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    download_count INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pages table
CREATE TABLE cms.pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    slug VARCHAR(300) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    template VARCHAR(100) DEFAULT 'default',
    parent_page_id INTEGER REFERENCES cms.pages(id),
    author_id INTEGER REFERENCES public.users(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INTEGER DEFAULT 0,
    seo_title VARCHAR(200),
    seo_description VARCHAR(500),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table (key-value store)
CREATE TABLE cms.settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    value_type VARCHAR(20) DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'array')),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW public.user_order_summary AS
SELECT
    u.id,
    u.username,
    u.email,
    u.full_name,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as lifetime_value,
    MAX(o.ordered_at) as last_order_date,
    u.created_at as member_since
FROM public.users u
LEFT JOIN public.orders o ON u.id = o.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.email, u.full_name, u.created_at;

CREATE VIEW inventory.product_summary AS
SELECT
    p.id,
    p.sku,
    p.name,
    c.name as category_name,
    p.price,
    p.quantity,
    p.reserved_quantity,
    (p.quantity - p.reserved_quantity) as available_quantity,
    p.rating,
    p.review_count,
    p.is_available,
    p.created_at
FROM inventory.products p
LEFT JOIN inventory.categories c ON p.category_id = c.id;

CREATE VIEW hr.employee_summary AS
SELECT
    e.id,
    e.employee_number,
    e.first_name || ' ' || e.last_name as full_name,
    e.email,
    e.job_title,
    d.name as department_name,
    m.first_name || ' ' || m.last_name as manager_name,
    e.employment_type,
    e.employment_status,
    e.salary,
    e.hire_date,
    EXTRACT(YEAR FROM AGE(NOW(), e.hire_date)) as years_of_service
FROM hr.employees e
LEFT JOIN hr.departments d ON e.department_id = d.id
LEFT JOIN hr.employees m ON e.manager_id = m.id;

CREATE VIEW finance.invoice_summary AS
SELECT
    i.id,
    i.invoice_number,
    c.customer_number,
    c.company_name,
    c.contact_name,
    i.issue_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_due,
    i.status,
    CASE
        WHEN i.status = 'paid' THEN 'On Time'
        WHEN i.due_date < CURRENT_DATE AND i.status != 'paid' THEN 'Overdue'
        ELSE 'Pending'
    END as payment_status
FROM finance.invoices i
JOIN finance.customers c ON i.customer_id = c.id;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_created_at ON public.users(created_at);
CREATE INDEX idx_users_metadata ON public.users USING GIN(metadata);
CREATE INDEX idx_users_tags ON public.users USING GIN(tags);

-- Orders indexes
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_ordered_at ON public.orders(ordered_at);

-- Products indexes
CREATE INDEX idx_products_sku ON inventory.products(sku);
CREATE INDEX idx_products_category_id ON inventory.products(category_id);
CREATE INDEX idx_products_name ON inventory.products USING GIN(name gin_trgm_ops);
CREATE INDEX idx_products_tags ON inventory.products USING GIN(tags);

-- Employees indexes
CREATE INDEX idx_employees_department_id ON hr.employees(department_id);
CREATE INDEX idx_employees_manager_id ON hr.employees(manager_id);
CREATE INDEX idx_employees_status ON hr.employees(employment_status);

-- Analytics indexes
CREATE INDEX idx_events_user_id ON analytics.events(user_id);
CREATE INDEX idx_events_type ON analytics.events(event_type);
CREATE INDEX idx_events_occurred_at ON analytics.events(occurred_at);

-- ============================================================================
-- SAMPLE DATA INSERTION
-- ============================================================================

-- Insert Users (1000+ users using generate_series for efficiency)
-- First, insert the initial 20 named users
INSERT INTO public.users (email, username, password_hash, first_name, last_name, role, status, is_active, is_verified, age, salary, phone_number, bio, tags, birth_date, preferences) VALUES
('alice.johnson@example.com', 'alice', '$2a$10$xyz...', 'Alice', 'Johnson', 'admin', 'active', true, true, 32, 95000.00, '+1-555-0101', 'Senior Software Engineer with 8 years of experience', ARRAY['engineering', 'leadership'], '1992-03-15', '{"theme": "dark", "notifications": true, "language": "en"}'),
('bob.smith@example.com', 'bob', '$2a$10$abc...', 'Bob', 'Smith', 'user', 'active', true, true, 28, 75000.00, '+1-555-0102', 'Full-stack developer', ARRAY['development'], '1996-07-22', '{"theme": "light", "notifications": true}'),
('carol.williams@example.com', 'carol', '$2a$10$def...', 'Carol', 'Williams', 'user', 'active', true, true, 35, 82000.00, '+1-555-0103', 'UX Designer focused on accessibility', ARRAY['design', 'ux'], '1989-11-08', '{"theme": "light", "notifications": false}'),
('david.brown@example.com', 'david', '$2a$10$ghi...', 'David', 'Brown', 'moderator', 'active', true, true, 41, 88000.00, '+1-555-0104', 'Customer support lead', ARRAY['support', 'management'], '1983-05-19', '{"theme": "dark", "notifications": true}'),
('eve.davis@example.com', 'eve', '$2a$10$jkl...', 'Eve', 'Davis', 'user', 'active', true, false, 26, 68000.00, '+1-555-0105', 'Junior developer learning React', ARRAY['development', 'frontend'], '1998-09-30', '{"theme": "light", "notifications": true}'),
('frank.miller@example.com', 'frank', '$2a$10$mno...', 'Frank', 'Miller', 'user', 'inactive', false, true, 45, 92000.00, '+1-555-0106', NULL, ARRAY['backend'], '1979-12-03', '{"theme": "dark", "notifications": false}'),
('grace.lee@example.com', 'grace', '$2a$10$pqr...', 'Grace', 'Lee', 'user', 'active', true, true, 29, 71000.00, '+1-555-0107', 'Data analyst', ARRAY['analytics', 'data'], '1995-04-17', '{"theme": "light", "notifications": true}'),
('henry.wilson@example.com', 'henry', '$2a$10$stu...', 'Henry', 'Wilson', 'admin', 'active', true, true, 38, 105000.00, '+1-555-0108', 'CTO and co-founder', ARRAY['leadership', 'engineering'], '1986-08-25', '{"theme": "dark", "notifications": true}'),
('iris.moore@example.com', 'iris', '$2a$10$vwx...', 'Iris', 'Moore', 'user', 'pending', true, false, 24, 62000.00, '+1-555-0109', 'QA Engineer intern', ARRAY['qa', 'testing'], '2000-01-14', '{"theme": "light", "notifications": true}'),
('jack.taylor@example.com', 'jack', '$2a$10$yza...', 'Jack', 'Taylor', 'user', 'active', true, true, 33, 79000.00, '+1-555-0110', 'DevOps engineer', ARRAY['devops', 'infrastructure'], '1991-06-28', '{"theme": "dark", "notifications": true}'),
('kate.anderson@example.com', 'kate', '$2a$10$bcd...', 'Kate', 'Anderson', 'user', 'active', true, true, 30, 74000.00, '+1-555-0111', NULL, ARRAY['marketing'], '1994-10-05', '{"theme": "light", "notifications": false}'),
('liam.thomas@example.com', 'liam', '$2a$10$efg...', 'Liam', 'Thomas', 'moderator', 'active', true, true, 36, 86000.00, '+1-555-0112', 'Community manager', ARRAY['community', 'support'], '1988-02-12', '{"theme": "dark", "notifications": true}'),
('maya.jackson@example.com', 'maya', '$2a$10$hij...', 'Maya', 'Jackson', 'user', 'suspended', false, true, 27, 69000.00, '+1-555-0113', NULL, ARRAY[]::TEXT[], '1997-07-20', '{"theme": "light", "notifications": true}'),
('noah.white@example.com', 'noah', '$2a$10$klm...', 'Noah', 'White', 'user', 'active', true, true, 31, 77000.00, '+1-555-0114', 'Mobile developer', ARRAY['mobile', 'ios'], '1993-03-09', '{"theme": "dark", "notifications": true}'),
('olivia.harris@example.com', 'olivia', '$2a$10$nop...', 'Olivia', 'Harris', 'user', 'active', true, true, 34, 81000.00, '+1-555-0115', 'Product manager', ARRAY['product', 'management'], '1990-11-27', '{"theme": "light", "notifications": true}'),
('peter.martin@example.com', 'peter', '$2a$10$qrs...', 'Peter', 'Martin', 'user', 'active', true, false, 25, 65000.00, '+1-555-0116', NULL, ARRAY['sales'], '1999-05-16', '{"theme": "light", "notifications": false}'),
('quinn.garcia@example.com', 'quinn', '$2a$10$tuv...', 'Quinn', 'Garcia', 'guest', 'active', true, true, 22, NULL, '+1-555-0117', 'Student intern', ARRAY['intern'], '2002-08-03', '{"theme": "light", "notifications": true}'),
('rachel.martinez@example.com', 'rachel', '$2a$10$wxy...', 'Rachel', 'Martinez', 'user', 'active', true, true, 39, 89000.00, '+1-555-0118', 'HR manager', ARRAY['hr', 'people'], '1985-12-11', '{"theme": "dark", "notifications": true}'),
('sam.robinson@example.com', 'sam', '$2a$10$zab...', 'Sam', 'Robinson', 'user', 'active', true, true, 29, 73000.00, '+1-555-0119', NULL, ARRAY['finance'], '1995-04-28', '{"theme": "light", "notifications": true}'),
('tina.clark@example.com', 'tina', '$2a$10$cde...', 'Tina', 'Clark', 'user', 'active', true, true, 37, 84000.00, '+1-555-0120', 'Content strategist', ARRAY['content', 'marketing'], '1987-09-14', '{"theme": "light", "notifications": false}');

-- Generate 10000 additional users using generate_series
INSERT INTO public.users (email, username, password_hash, first_name, last_name, role, status, is_active, is_verified, age, salary, phone_number, bio, tags, birth_date, preferences)
SELECT
    'user' || i || '@example.com',
    'user' || i,
    '$2a$10$' || md5(random()::text),
    CASE (i % 50)
        WHEN 0 THEN 'James' WHEN 1 THEN 'Mary' WHEN 2 THEN 'John' WHEN 3 THEN 'Patricia'
        WHEN 4 THEN 'Robert' WHEN 5 THEN 'Jennifer' WHEN 6 THEN 'Michael' WHEN 7 THEN 'Linda'
        WHEN 8 THEN 'William' WHEN 9 THEN 'Barbara' WHEN 10 THEN 'David' WHEN 11 THEN 'Elizabeth'
        WHEN 12 THEN 'Richard' WHEN 13 THEN 'Susan' WHEN 14 THEN 'Joseph' WHEN 15 THEN 'Jessica'
        WHEN 16 THEN 'Thomas' WHEN 17 THEN 'Sarah' WHEN 18 THEN 'Charles' WHEN 19 THEN 'Karen'
        WHEN 20 THEN 'Christopher' WHEN 21 THEN 'Nancy' WHEN 22 THEN 'Daniel' WHEN 23 THEN 'Lisa'
        WHEN 24 THEN 'Matthew' WHEN 25 THEN 'Betty' WHEN 26 THEN 'Anthony' WHEN 27 THEN 'Margaret'
        WHEN 28 THEN 'Mark' WHEN 29 THEN 'Sandra' WHEN 30 THEN 'Donald' WHEN 31 THEN 'Ashley'
        WHEN 32 THEN 'Steven' WHEN 33 THEN 'Kimberly' WHEN 34 THEN 'Paul' WHEN 35 THEN 'Emily'
        WHEN 36 THEN 'Andrew' WHEN 37 THEN 'Donna' WHEN 38 THEN 'Joshua' WHEN 39 THEN 'Michelle'
        WHEN 40 THEN 'Kenneth' WHEN 41 THEN 'Dorothy' WHEN 42 THEN 'Kevin' WHEN 43 THEN 'Carol'
        WHEN 44 THEN 'Brian' WHEN 45 THEN 'Amanda' WHEN 46 THEN 'George' WHEN 47 THEN 'Melissa'
        WHEN 48 THEN 'Timothy' WHEN 49 THEN 'Deborah' ELSE 'Alex'
    END,
    CASE (i % 50)
        WHEN 0 THEN 'Smith' WHEN 1 THEN 'Johnson' WHEN 2 THEN 'Williams' WHEN 3 THEN 'Brown'
        WHEN 4 THEN 'Jones' WHEN 5 THEN 'Garcia' WHEN 6 THEN 'Miller' WHEN 7 THEN 'Davis'
        WHEN 8 THEN 'Rodriguez' WHEN 9 THEN 'Martinez' WHEN 10 THEN 'Hernandez' WHEN 11 THEN 'Lopez'
        WHEN 12 THEN 'Gonzalez' WHEN 13 THEN 'Wilson' WHEN 14 THEN 'Anderson' WHEN 15 THEN 'Thomas'
        WHEN 16 THEN 'Taylor' WHEN 17 THEN 'Moore' WHEN 18 THEN 'Jackson' WHEN 19 THEN 'Martin'
        WHEN 20 THEN 'Lee' WHEN 21 THEN 'Perez' WHEN 22 THEN 'Thompson' WHEN 23 THEN 'White'
        WHEN 24 THEN 'Harris' WHEN 25 THEN 'Sanchez' WHEN 26 THEN 'Clark' WHEN 27 THEN 'Ramirez'
        WHEN 28 THEN 'Lewis' WHEN 29 THEN 'Robinson' WHEN 30 THEN 'Walker' WHEN 31 THEN 'Young'
        WHEN 32 THEN 'Allen' WHEN 33 THEN 'King' WHEN 34 THEN 'Wright' WHEN 35 THEN 'Scott'
        WHEN 36 THEN 'Torres' WHEN 37 THEN 'Nguyen' WHEN 38 THEN 'Hill' WHEN 39 THEN 'Flores'
        WHEN 40 THEN 'Green' WHEN 41 THEN 'Adams' WHEN 42 THEN 'Nelson' WHEN 43 THEN 'Baker'
        WHEN 44 THEN 'Hall' WHEN 45 THEN 'Rivera' WHEN 46 THEN 'Campbell' WHEN 47 THEN 'Mitchell'
        WHEN 48 THEN 'Carter' WHEN 49 THEN 'Roberts' ELSE 'Cooper'
    END,
    CASE (i % 20)
        WHEN 0 THEN 'admin'
        WHEN 1 THEN 'moderator'
        WHEN 2 THEN 'guest'
        ELSE 'user'
    END,
    CASE (i % 10)
        WHEN 0 THEN 'inactive'
        WHEN 1 THEN 'pending'
        WHEN 2 THEN 'suspended'
        ELSE 'active'
    END,
    CASE WHEN (i % 10) = 0 THEN false ELSE true END,
    CASE WHEN (i % 5) = 0 THEN false ELSE true END,
    20 + (i % 50),
    45000.00 + (i % 100) * 1000.00,
    '+1-555-' || LPAD((1000 + i)::text, 4, '0'),
    CASE WHEN (i % 3) = 0 THEN 'Experienced professional in their field' ELSE NULL END,
    CASE (i % 10)
        WHEN 0 THEN ARRAY['engineering', 'software']
        WHEN 1 THEN ARRAY['design', 'creative']
        WHEN 2 THEN ARRAY['sales', 'business']
        WHEN 3 THEN ARRAY['support', 'customer-service']
        WHEN 4 THEN ARRAY['marketing', 'content']
        WHEN 5 THEN ARRAY['finance', 'accounting']
        WHEN 6 THEN ARRAY['hr', 'people']
        WHEN 7 THEN ARRAY['operations', 'logistics']
        WHEN 8 THEN ARRAY['product', 'management']
        ELSE ARRAY['general']
    END,
    DATE '1970-01-01' + (i % 18250) * INTERVAL '1 day',
    CASE WHEN (i % 2) = 0
        THEN '{"theme": "dark", "notifications": true}'::jsonb
        ELSE '{"theme": "light", "notifications": false}'::jsonb
    END
FROM generate_series(1, 10000) AS i;

-- Insert Categories
INSERT INTO inventory.categories (name, slug, description, parent_id, is_active) VALUES
('Electronics', 'electronics', 'Electronic devices and accessories', NULL, true),
('Computers', 'computers', 'Desktop and laptop computers', 1, true),
('Laptops', 'laptops', 'Portable computers', 2, true),
('Desktops', 'desktops', 'Desktop computers', 2, true),
('Accessories', 'accessories', 'Computer and electronic accessories', 1, true),
('Audio', 'audio', 'Audio equipment', 1, true),
('Office Supplies', 'office-supplies', 'Office and stationery supplies', NULL, true),
('Furniture', 'furniture', 'Office furniture', 7, true),
('Stationery', 'stationery', 'Pens, papers, and supplies', 7, true),
('Clothing', 'clothing', 'Apparel and fashion', NULL, true);

-- Insert Products (50 products)
INSERT INTO inventory.products (sku, name, slug, description, category_id, brand, price, cost, quantity, weight, dimensions, tags, rating, review_count, is_available, is_featured) VALUES
('LAPTOP-001', 'Pro Laptop 15"', 'pro-laptop-15', 'High-performance laptop for professionals', 3, 'TechPro', 1299.99, 950.00, 50, 2.1, '{"width": 35, "height": 2.5, "depth": 24}', ARRAY['laptop', 'computer', 'work'], 4.5, 127, true, true),
('LAPTOP-002', 'Business Laptop 14"', 'business-laptop-14', 'Reliable laptop for business users', 3, 'BizTech', 899.99, 650.00, 75, 1.8, '{"width": 32, "height": 2.2, "depth": 22}', ARRAY['laptop', 'business'], 4.2, 89, true, false),
('LAPTOP-003', 'Gaming Laptop 17"', 'gaming-laptop-17', 'Powerful gaming laptop with RGB', 3, 'GameForce', 1899.99, 1400.00, 30, 3.2, '{"width": 39, "height": 3.0, "depth": 27}', ARRAY['laptop', 'gaming', 'rgb'], 4.7, 201, true, true),
('DESKTOP-001', 'Workstation Pro', 'workstation-pro', 'Professional desktop workstation', 4, 'TechPro', 2499.99, 1800.00, 20, 12.5, '{"width": 45, "height": 50, "depth": 20}', ARRAY['desktop', 'workstation'], 4.6, 54, true, false),
('MOUSE-001', 'Wireless Mouse', 'wireless-mouse', 'Ergonomic wireless mouse', 5, 'Ergo', 49.99, 25.00, 200, 0.15, '{"width": 7, "height": 4, "depth": 12}', ARRAY['mouse', 'wireless', 'ergonomic'], 4.3, 312, true, false),
('MOUSE-002', 'Gaming Mouse RGB', 'gaming-mouse-rgb', 'High-precision gaming mouse', 5, 'GameForce', 79.99, 40.00, 150, 0.18, '{"width": 7, "height": 4, "depth": 13}', ARRAY['mouse', 'gaming', 'rgb'], 4.6, 445, true, true),
('KEYBOARD-001', 'Mechanical Keyboard', 'mechanical-keyboard', 'RGB mechanical keyboard', 5, 'KeyMaster', 129.99, 70.00, 75, 1.2, '{"width": 44, "height": 3.5, "depth": 13}', ARRAY['keyboard', 'mechanical', 'rgb'], 4.4, 234, true, false),
('KEYBOARD-002', 'Wireless Keyboard Slim', 'wireless-keyboard-slim', 'Slim wireless keyboard', 5, 'Ergo', 59.99, 30.00, 120, 0.6, '{"width": 42, "height": 1.5, "depth": 12}', ARRAY['keyboard', 'wireless', 'slim'], 4.1, 156, true, false),
('MONITOR-001', '27" 4K Monitor', 'monitor-27-4k', 'Ultra HD monitor with HDR', 5, 'ViewPro', 449.99, 300.00, 60, 5.5, '{"width": 61, "height": 46, "depth": 7}', ARRAY['monitor', '4k', 'hdr'], 4.5, 178, true, true),
('MONITOR-002', '32" Curved Gaming Monitor', 'monitor-32-curved-gaming', 'Immersive curved gaming display', 5, 'GameForce', 599.99, 400.00, 40, 7.2, '{"width": 71, "height": 52, "depth": 15}', ARRAY['monitor', 'gaming', 'curved'], 4.7, 289, true, true),
('HEADSET-001', 'Noise Cancelling Headset', 'headset-noise-cancelling', 'Premium wireless headset', 6, 'AudioPro', 199.99, 120.00, 100, 0.3, '{"width": 18, "height": 20, "depth": 8}', ARRAY['headset', 'wireless', 'noise-cancelling'], 4.6, 523, true, true),
('HEADSET-002', 'Gaming Headset 7.1', 'gaming-headset-71', 'Surround sound gaming headset', 6, 'GameForce', 149.99, 85.00, 80, 0.35, '{"width": 19, "height": 21, "depth": 9}', ARRAY['headset', 'gaming', 'surround'], 4.4, 367, true, false),
('WEBCAM-001', '1080p HD Webcam', 'webcam-1080p-hd', 'Full HD webcam for meetings', 5, 'ViewPro', 89.99, 50.00, 90, 0.2, '{"width": 10, "height": 5, "depth": 7}', ARRAY['webcam', 'hd', 'meeting'], 4.2, 198, true, false),
('SPEAKER-001', 'Bluetooth Speaker', 'bluetooth-speaker', 'Portable Bluetooth speaker', 6, 'AudioPro', 79.99, 45.00, 110, 0.6, '{"width": 15, "height": 7, "depth": 7}', ARRAY['speaker', 'bluetooth', 'portable'], 4.3, 276, true, false),
('DESK-001', 'Standing Desk Electric', 'standing-desk-electric', 'Adjustable standing desk', 8, 'OfficePro', 599.99, 350.00, 25, 45.0, '{"width": 140, "height": 75, "depth": 70}', ARRAY['desk', 'standing', 'electric'], 4.7, 143, true, true),
('CHAIR-001', 'Ergonomic Office Chair', 'ergonomic-office-chair', 'Comfortable ergonomic chair', 8, 'ErgoSeat', 399.99, 230.00, 40, 18.5, '{"width": 65, "height": 120, "depth": 65}', ARRAY['chair', 'ergonomic', 'office'], 4.5, 267, true, true),
('PRINTER-001', 'Laser Printer Color', 'laser-printer-color', 'Color laser printer', 5, 'PrintMaster', 299.99, 180.00, 35, 15.0, '{"width": 45, "height": 38, "depth": 42}', ARRAY['printer', 'laser', 'color'], 4.1, 92, true, false),
('TABLET-001', '10" Tablet Pro', 'tablet-10-pro', 'Professional tablet with stylus', 1, 'TabletPro', 699.99, 450.00, 55, 0.5, '{"width": 24, "height": 17, "depth": 0.7}', ARRAY['tablet', 'stylus', 'professional'], 4.6, 234, true, true),
('CABLE-001', 'USB-C Cable 2m', 'usb-c-cable-2m', 'High-speed USB-C cable', 5, 'CableTech', 19.99, 8.00, 500, 0.05, '{"width": 2, "height": 2, "depth": 200}', ARRAY['cable', 'usb-c'], 4.0, 1023, true, false),
('ADAPTER-001', 'USB Hub 7-Port', 'usb-hub-7port', '7-port USB 3.0 hub', 5, 'CableTech', 39.99, 20.00, 150, 0.15, '{"width": 12, "height": 2, "depth": 4}', ARRAY['usb', 'hub', 'adapter'], 4.2, 445, true, false);

-- Insert Warehouses
INSERT INTO inventory.warehouses (code, name, address, manager_name, phone, capacity, is_active, opened_at) VALUES
('WH-SEA', 'Seattle Main Warehouse', '{"street": "1234 Industrial Way", "city": "Seattle", "state": "WA", "zip": "98101", "country": "USA"}', 'John Manager', '+1-555-1001', 50000, true, '2020-01-15'),
('WH-PDX', 'Portland Distribution Center', '{"street": "5678 Commerce Blvd", "city": "Portland", "state": "OR", "zip": "97201", "country": "USA"}', 'Jane Supervisor', '+1-555-1002', 35000, true, '2021-06-01'),
('WH-SF', 'San Francisco Warehouse', '{"street": "9012 Bay Street", "city": "San Francisco", "state": "CA", "zip": "94102", "country": "USA"}', 'Mike Handler', '+1-555-1003', 28000, true, '2022-03-20');

-- Insert Departments
INSERT INTO hr.departments (code, name, description, budget, location, established_date) VALUES
('ENG', 'Engineering', 'Software development and engineering', 2500000.00, 'Seattle, WA', '2018-01-01'),
('SALES', 'Sales', 'Sales and business development', 1200000.00, 'New York, NY', '2018-01-01'),
('MKT', 'Marketing', 'Marketing and brand management', 800000.00, 'San Francisco, CA', '2018-03-01'),
('SUP', 'Support', 'Customer support and success', 600000.00, 'Austin, TX', '2018-06-01'),
('HR', 'Human Resources', 'People operations and HR', 400000.00, 'Seattle, WA', '2018-01-01'),
('FIN', 'Finance', 'Finance and accounting', 500000.00, 'New York, NY', '2018-01-01'),
('OPS', 'Operations', 'Operations and logistics', 700000.00, 'Portland, OR', '2019-01-01');

-- Insert Employees (linking to departments)
INSERT INTO hr.employees (employee_number, user_id, department_id, first_name, last_name, email, job_title, employment_type, salary, hire_date) VALUES
('EMP-001', 1, 1, 'Alice', 'Johnson', 'alice.johnson@company.com', 'Senior Software Engineer', 'full-time', 95000.00, '2020-03-15'),
('EMP-002', 2, 1, 'Bob', 'Smith', 'bob.smith@company.com', 'Software Engineer', 'full-time', 75000.00, '2021-07-22'),
('EMP-003', 3, 3, 'Carol', 'Williams', 'carol.williams@company.com', 'UX Designer', 'full-time', 82000.00, '2020-11-08'),
('EMP-004', 4, 4, 'David', 'Brown', 'david.brown@company.com', 'Support Lead', 'full-time', 88000.00, '2019-05-19'),
('EMP-005', 5, 1, 'Eve', 'Davis', 'eve.davis@company.com', 'Junior Developer', 'full-time', 68000.00, '2023-09-30'),
('EMP-006', 7, 1, 'Grace', 'Lee', 'grace.lee@company.com', 'Data Analyst', 'full-time', 71000.00, '2022-04-17'),
('EMP-007', 8, 1, 'Henry', 'Wilson', 'henry.wilson@company.com', 'CTO', 'full-time', 180000.00, '2018-01-01'),
('EMP-008', 10, 7, 'Jack', 'Taylor', 'jack.taylor@company.com', 'DevOps Engineer', 'full-time', 79000.00, '2021-06-28'),
('EMP-009', 11, 3, 'Kate', 'Anderson', 'kate.anderson@company.com', 'Marketing Manager', 'full-time', 74000.00, '2020-10-05'),
('EMP-010', 12, 4, 'Liam', 'Thomas', 'liam.thomas@company.com', 'Community Manager', 'full-time', 86000.00, '2019-02-12');

-- Update department managers
UPDATE hr.departments SET manager_id = 7 WHERE code = 'ENG';
UPDATE hr.departments SET manager_id = 9 WHERE code = 'MKT';
UPDATE hr.departments SET manager_id = 4 WHERE code = 'SUP';

-- Insert Projects
INSERT INTO hr.projects (code, name, description, department_id, project_manager_id, status, priority, budget, start_date, end_date) VALUES
('PRJ-001', 'Website Redesign', 'Complete redesign of company website', 3, 3, 'active', 'high', 150000.00, '2024-01-15', '2024-06-30'),
('PRJ-002', 'Mobile App V2', 'Version 2 of mobile application', 1, 1, 'active', 'critical', 300000.00, '2024-02-01', '2024-09-30'),
('PRJ-003', 'Customer Portal', 'Self-service customer portal', 1, 1, 'planning', 'medium', 200000.00, '2024-04-01', '2024-10-31'),
('PRJ-004', 'Support System Upgrade', 'Upgrade to support ticket system', 4, 4, 'completed', 'high', 80000.00, '2023-10-01', '2024-01-31'),
('PRJ-005', 'Marketing Automation', 'Implement marketing automation tools', 3, 9, 'active', 'medium', 100000.00, '2024-03-01', '2024-07-31');

-- Insert Tasks
INSERT INTO hr.tasks (project_id, assigned_to, created_by, title, description, status, priority, estimated_hours, due_date) VALUES
(1, 3, 1, 'Design new homepage', 'Create mockups for new homepage design', 'in-progress', 'high', 40.00, '2024-02-15'),
(1, 3, 1, 'Create component library', 'Build reusable UI component library', 'done', 'medium', 80.00, '2024-02-01'),
(2, 2, 1, 'Implement user authentication', 'Add OAuth and SSO support', 'in-progress', 'high', 60.00, '2024-03-15'),
(2, 5, 1, 'Build dashboard UI', 'Create responsive dashboard interface', 'todo', 'medium', 100.00, '2024-04-01'),
(3, 1, 1, 'API design', 'Design RESTful API for portal', 'in-progress', 'high', 50.00, '2024-04-20'),
(5, 9, 9, 'Setup email campaigns', 'Configure automated email workflows', 'review', 'medium', 30.00, '2024-03-30');

-- Insert Customers
INSERT INTO finance.customers (customer_number, company_name, contact_name, email, phone, customer_type, credit_limit, payment_terms, billing_address) VALUES
('CUST-001', 'Acme Corporation', 'John Acme', 'john@acme.com', '+1-555-2001', 'business', 50000.00, 'Net 30', '{"street": "100 Business Ave", "city": "New York", "state": "NY", "zip": "10001"}'),
('CUST-002', 'TechStart Inc', 'Sarah Founder', 'sarah@techstart.com', '+1-555-2002', 'business', 25000.00, 'Net 15', '{"street": "200 Startup Ln", "city": "San Francisco", "state": "CA", "zip": "94102"}'),
('CUST-003', 'Global Enterprises', 'Michael Global', 'michael@global.com', '+1-555-2003', 'business', 100000.00, 'Net 45', '{"street": "300 Corporate Dr", "city": "Chicago", "state": "IL", "zip": "60601"}'),
('CUST-004', NULL, 'Emily Individual', 'emily@email.com', '+1-555-2004', 'individual', 5000.00, 'Immediate', '{"street": "400 Home St", "city": "Seattle", "state": "WA", "zip": "98101"}'),
('CUST-005', 'City Government', 'Robert Official', 'robert@city.gov', '+1-555-2005', 'government', 200000.00, 'Net 60', '{"street": "500 City Hall", "city": "Boston", "state": "MA", "zip": "02101"}');

-- Insert Orders
INSERT INTO public.orders (order_number, user_id, status, total_amount, discount_amount, tax_amount, payment_method, shipping_address, estimated_delivery) VALUES
('ORD-2024-001', 1, 'delivered', 1349.98, 0.00, 108.00, 'credit_card', '{"street": "123 Main St", "city": "Seattle", "state": "WA", "zip": "98101"}', '2024-01-20'),
('ORD-2024-002', 2, 'shipped', 179.98, 10.00, 13.60, 'paypal', '{"street": "456 Oak Ave", "city": "Portland", "state": "OR", "zip": "97201"}', '2024-02-10'),
('ORD-2024-003', 1, 'processing', 449.99, 0.00, 36.00, 'credit_card', '{"street": "123 Main St", "city": "Seattle", "state": "WA", "zip": "98101"}', '2024-02-15'),
('ORD-2024-004', 3, 'delivered', 49.99, 5.00, 3.60, 'debit_card', '{"street": "789 Pine Rd", "city": "San Francisco", "state": "CA", "zip": "94102"}', '2024-01-25'),
('ORD-2024-005', 7, 'cancelled', 899.99, 0.00, 72.00, 'credit_card', '{"street": "321 Elm St", "city": "Austin", "state": "TX", "zip": "78701"}', NULL),
('ORD-2024-006', 10, 'pending', 299.97, 30.00, 21.60, 'bank_transfer', '{"street": "654 Maple Dr", "city": "Denver", "state": "CO", "zip": "80201"}', '2024-02-20');

-- Insert Order Items
INSERT INTO public.order_items (order_id, product_id, product_name, sku, quantity, unit_price, subtotal) VALUES
(1, 1, 'Pro Laptop 15"', 'LAPTOP-001', 1, 1299.99, 1299.99),
(1, 5, 'Wireless Mouse', 'MOUSE-001', 1, 49.99, 49.99),
(2, 7, 'Mechanical Keyboard', 'KEYBOARD-001', 1, 129.99, 129.99),
(2, 5, 'Wireless Mouse', 'MOUSE-001', 1, 49.99, 49.99),
(3, 9, '27" 4K Monitor', 'MONITOR-001', 1, 449.99, 449.99),
(4, 5, 'Wireless Mouse', 'MOUSE-001', 1, 49.99, 49.99),
(5, 2, 'Business Laptop 14"', 'LAPTOP-002', 1, 899.99, 899.99),
(6, 19, 'USB-C Cable 2m', 'CABLE-001', 3, 19.99, 59.97),
(6, 20, 'USB Hub 7-Port', 'ADAPTER-001', 6, 39.99, 239.94);

-- Insert Invoices
INSERT INTO finance.invoices (invoice_number, customer_id, order_id, issue_date, due_date, subtotal, tax_amount, total_amount, amount_paid, amount_due, status) VALUES
('INV-2024-001', 1, 1, '2024-01-15', '2024-02-14', 1349.98, 108.00, 1457.98, 1457.98, 0.00, 'paid'),
('INV-2024-002', 2, 2, '2024-01-20', '2024-02-04', 169.98, 13.60, 183.58, 0.00, 183.58, 'sent'),
('INV-2024-003', 3, NULL, '2024-02-01', '2024-03-17', 5000.00, 400.00, 5400.00, 2000.00, 3400.00, 'partial'),
('INV-2024-004', 4, 4, '2024-01-18', '2024-01-18', 44.99, 3.60, 48.59, 48.59, 0.00, 'paid'),
('INV-2024-005', 5, NULL, '2023-12-15', '2024-01-14', 25000.00, 2000.00, 27000.00, 0.00, 27000.00, 'overdue');

-- Insert Invoice Items
INSERT INTO finance.invoice_items (invoice_id, description, quantity, unit_price, discount_percentage, tax_percentage, amount) VALUES
(1, 'Pro Laptop 15" - High-performance laptop', 1, 1299.99, 0, 8, 1299.99),
(1, 'Wireless Mouse - Ergonomic design', 1, 49.99, 0, 8, 49.99),
(2, 'Mechanical Keyboard - RGB backlight', 1, 129.99, 0, 8, 129.99),
(2, 'Wireless Mouse - Ergonomic design', 1, 49.99, 10, 8, 44.99),
(3, 'Professional Services - Consulting', 40, 125.00, 0, 8, 5000.00),
(4, 'Wireless Mouse - Ergonomic design', 1, 49.99, 10, 8, 44.99),
(5, 'Enterprise License - Annual', 1, 25000.00, 0, 8, 25000.00);

-- Insert Payments
INSERT INTO finance.payments (payment_number, invoice_id, customer_id, payment_method, amount, reference_number, payment_date, processed_by) VALUES
('PAY-2024-001', 1, 1, 'credit_card', 1457.98, 'CC-123456789', '2024-01-16', 1),
('PAY-2024-002', 3, 3, 'bank_transfer', 2000.00, 'TXN-987654321', '2024-02-10', 1),
('PAY-2024-003', 4, 4, 'cash', 48.59, 'CASH-001', '2024-01-18', 1);

-- Insert Analytics Events
INSERT INTO analytics.events (event_type, event_name, user_id, properties, page_url, device_type) VALUES
('page_view', 'Homepage View', 1, '{"duration": 45, "scroll_depth": 80}', '/', 'desktop'),
('click', 'Product Click', 1, '{"product_id": 1, "product_name": "Pro Laptop 15\""}', '/products/pro-laptop-15', 'desktop'),
('add_to_cart', 'Add to Cart', 1, '{"product_id": 1, "quantity": 1, "price": 1299.99}', '/products/pro-laptop-15', 'desktop'),
('page_view', 'Cart View', 1, '{"cart_total": 1299.99, "cart_items": 1}', '/cart', 'desktop'),
('purchase', 'Order Complete', 1, '{"order_id": "ORD-2024-001", "amount": 1457.98, "items": 2}', '/checkout/success', 'desktop'),
('page_view', 'Homepage View', 2, '{"duration": 12, "scroll_depth": 30}', '/', 'mobile'),
('search', 'Product Search', 2, '{"query": "keyboard", "results": 5}', '/search?q=keyboard', 'mobile'),
('signup', 'User Signup', 5, '{"source": "google", "campaign": "summer2024"}', '/signup', 'desktop'),
('page_view', 'Dashboard View', 1, '{"duration": 120}', '/dashboard', 'desktop'),
('click', 'Feature Click', 3, '{"feature": "export_data"}', '/dashboard', 'desktop');

-- Insert Blog Posts
INSERT INTO cms.posts (title, slug, excerpt, content, author_id, category, tags, status, view_count, like_count, comment_count, published_at) VALUES
('Getting Started with Our Platform', 'getting-started-with-our-platform', 'Learn how to get started with our platform in just 5 minutes.', 'Full content of getting started guide...', 1, 'Tutorial', ARRAY['tutorial', 'getting-started', 'guide'], 'published', 1523, 89, 23, '2024-01-05 10:00:00'),
('10 Tips for Better Productivity', '10-tips-for-better-productivity', 'Boost your productivity with these proven tips.', 'Full content of productivity tips...', 3, 'Productivity', ARRAY['productivity', 'tips', 'workflow'], 'published', 2341, 156, 45, '2024-01-12 14:30:00'),
('New Features Released in v2.0', 'new-features-released-v20', 'Check out the amazing new features in version 2.0', 'Full content of release notes...', 8, 'News', ARRAY['release', 'features', 'update'], 'published', 3456, 234, 67, '2024-02-01 09:00:00'),
('Security Best Practices', 'security-best-practices', 'Keep your account secure with these best practices.', 'Full content of security guide...', 1, 'Security', ARRAY['security', 'best-practices', 'guide'], 'published', 1876, 92, 31, '2024-01-20 11:00:00'),
('Upcoming Features Preview', 'upcoming-features-preview', 'Sneak peek at what''s coming next.', 'Full content of preview...', 8, 'News', ARRAY['preview', 'roadmap', 'future'], 'draft', 0, 0, 0, NULL);

-- Insert Comments
INSERT INTO cms.comments (post_id, user_id, author_name, author_email, content, status) VALUES
(1, 2, 'Bob Smith', 'bob.smith@example.com', 'Great tutorial! Very helpful.', 'approved'),
(1, 3, 'Carol Williams', 'carol.williams@example.com', 'Thanks for this guide. Clear and concise.', 'approved'),
(2, 5, 'Eve Davis', 'eve.davis@example.com', 'These tips really work! My productivity has doubled.', 'approved'),
(2, 7, 'Grace Lee', 'grace.lee@example.com', 'Tip #7 is my favorite!', 'approved'),
(3, 1, 'Alice Johnson', 'alice.johnson@example.com', 'Excited about the new features!', 'approved'),
(3, 10, 'Jack Taylor', 'jack.taylor@example.com', 'When will v2.1 be released?', 'approved'),
(4, 12, 'Liam Thomas', 'liam.thomas@example.com', 'Everyone should read this.', 'approved');

-- Insert Settings
INSERT INTO cms.settings (key, value, value_type, description, is_public, category) VALUES
('site_name', 'DBView Platform', 'string', 'Website name', true, 'general'),
('site_description', 'Professional database management tool', 'string', 'Website description', true, 'general'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', false, 'system'),
('max_upload_size', '10485760', 'number', 'Maximum file upload size in bytes', false, 'uploads'),
('allowed_file_types', '["jpg","png","pdf","doc","docx"]', 'json', 'Allowed file types for upload', false, 'uploads'),
('contact_email', 'support@dbview.com', 'string', 'Contact email address', true, 'contact'),
('enable_comments', 'true', 'boolean', 'Enable comments on blog posts', true, 'blog'),
('posts_per_page', '10', 'number', 'Number of blog posts per page', true, 'blog');

-- ============================================================================
-- FUNCTIONS AND PROCEDURES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_orders(p_user_id INTEGER)
RETURNS TABLE(order_id INTEGER, order_number VARCHAR, status VARCHAR, total DECIMAL, ordered_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT id, orders.order_number, orders.status, total_amount, orders.ordered_at
    FROM public.orders
    WHERE user_id = p_user_id
    ORDER BY ordered_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION inventory.get_low_stock_products(p_threshold INTEGER DEFAULT 20)
RETURNS TABLE(product_id INTEGER, sku VARCHAR, name VARCHAR, quantity INTEGER, reorder_level INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT id, products.sku, products.name, products.quantity, products.reorder_level
    FROM inventory.products
    WHERE quantity <= p_threshold
    ORDER BY quantity ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hr.get_employee_projects(p_employee_id INTEGER)
RETURNS TABLE(project_id INTEGER, project_name VARCHAR, role VARCHAR, status VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name,
           CASE
               WHEN p.project_manager_id = p_employee_id THEN 'Project Manager'
               ELSE 'Team Member'
           END as role,
           p.status
    FROM hr.projects p
    LEFT JOIN hr.tasks t ON t.project_id = p.id
    WHERE p.project_manager_id = p_employee_id OR t.assigned_to = p_employee_id
    GROUP BY p.id, p.name, p.project_manager_id, p.status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON inventory.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON hr.employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbview;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA inventory TO dbview;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO dbview;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr TO dbview;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA finance TO dbview;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cms TO dbview;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA inventory TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hr TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finance TO dbview;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cms TO dbview;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO dbview;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA inventory TO dbview;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hr TO dbview;

-- ============================================================================
-- STATISTICS
-- ============================================================================

-- Analyze tables for better query planning
ANALYZE public.users;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE inventory.products;
ANALYZE inventory.categories;
ANALYZE hr.employees;
ANALYZE hr.departments;
ANALYZE hr.projects;
ANALYZE hr.tasks;
ANALYZE finance.customers;
ANALYZE finance.invoices;
ANALYZE finance.payments;
ANALYZE analytics.events;
ANALYZE cms.posts;
ANALYZE cms.comments;
