#!/bin/bash

# Output file
output="bundle.txt"

# Clear or create the output file
> "$output"

# Function to add a file to the bundle
bundle_file() {
    local file="$1"
    local ext="${file##*.}"
    
    echo "=== START FILE: $file ===" >> "$output"
    echo "=== TYPE: $ext ===" >> "$output"
    echo "" >> "$output"
    cat "$file" >> "$output"
    echo "" >> "$output"
    echo "=== END FILE: $file ===" >> "$output"
    echo "" >> "$output"
    echo "" >> "$output"
}

# Find all .vue and .ts files in current directory and subdirectories
find . -type f \( -name "*.vue" -o -name "*.ts" \) -not -path "./node_modules/*" | while read -r file; do
    bundle_file "$file"
done

echo "Files have been bundled into $output"