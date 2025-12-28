#!/bin/sh
# Cassandra initialization script
# This script runs after Cassandra is healthy and seeds sample data

echo "Waiting for Cassandra to be ready..."
sleep 5

echo "Running CQL initialization script..."
cqlsh cassandra -f /init.cql

echo "Generating 10000 additional users..."

# Arrays for data generation
FIRST_NAMES="James Mary John Patricia Robert Jennifer Michael Linda William Barbara David Elizabeth Richard Susan Joseph Jessica Thomas Sarah Charles Karen Christopher Nancy Daniel Lisa Matthew Betty Anthony Margaret Mark Sandra Donald Ashley Steven Kimberly Paul Emily Andrew Donna Joshua Michelle Kenneth Dorothy Kevin Carol Brian Amanda George Melissa Timothy Deborah"
LAST_NAMES="Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson Walker Young Allen King Wright Scott Torres Nguyen Hill Flores Green Adams Nelson Baker Hall Rivera Campbell Mitchell Carter Roberts"
CITIES="San Francisco New York Seattle Austin Denver Boston Chicago Portland Miami Phoenix"
STATES="CA NY WA TX CO MA IL OR FL AZ"
TAGS_POOL="developer premium early-adopter designer analyst manager admin security engineer data-team"

get_word() {
    echo "$1" | awk -v idx="$2" '{print $(idx + 1)}'
}

# Process in batches of 100 for better performance
batch_size=100
total_users=10000

for batch_start in $(seq 1 $batch_size $total_users); do
    batch_end=$((batch_start + batch_size - 1))
    if [ $batch_end -gt $total_users ]; then
        batch_end=$total_users
    fi

    # Build batch CQL statements
    cql_batch="BEGIN BATCH "

    for i in $(seq $batch_start $batch_end); do
        first_idx=$((i % 50))
        last_idx=$((i % 50))
        city_idx=$((i % 10))
        state_idx=$((i % 10))
        tag1_idx=$((i % 10))
        tag2_idx=$(((i + 3) % 10))

        first_name=$(get_word "$FIRST_NAMES" $first_idx)
        last_name=$(get_word "$LAST_NAMES" $last_idx)
        city=$(get_word "$CITIES" $city_idx)
        state=$(get_word "$STATES" $state_idx)
        tag1=$(get_word "$TAGS_POOL" $tag1_idx)
        tag2=$(get_word "$TAGS_POOL" $tag2_idx)

        is_active="true"
        if [ $((i % 10)) -eq 0 ]; then
            is_active="false"
        fi

        zip_code=$((10000 + (i % 90000)))
        phone_num="+1-555-$(printf '%04d' $((i % 10000)))"

        cql_batch="${cql_batch} INSERT INTO dbview_dev.users (user_id, email, username, first_name, last_name, address, phones, tags, preferences, created_at, updated_at, is_active) VALUES (uuid(), 'user${i}@example.com', 'user${i}', '${first_name}', '${last_name}', {street: '${i} Main St', city: '${city}', state: '${state}', zip: '${zip_code}', country: 'USA'}, {{type: 'mobile', number: '${phone_num}'}}, {'${tag1}', '${tag2}'}, {'theme': 'dark', 'language': 'en'}, toTimestamp(now()), toTimestamp(now()), ${is_active});"
    done

    cql_batch="${cql_batch} APPLY BATCH;"

    echo "$cql_batch" | cqlsh cassandra

    echo "Inserted users $batch_start to $batch_end"
done

echo "Cassandra initialization complete with 10000+ users!"
