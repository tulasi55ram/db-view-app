#!/bin/sh
# Cassandra initialization script
# This script runs after Cassandra is healthy and seeds sample data

echo "Waiting for Cassandra to be ready..."
sleep 5

echo "Running CQL initialization script..."
cqlsh cassandra -f /init.cql

echo "Cassandra initialization complete!"
