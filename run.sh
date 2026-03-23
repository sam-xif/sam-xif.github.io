#!/bin/bash

# Navigate to the directory containing the website files
cd $(dirname "$0")

if [[ "$1" == "--build" ]]; then
    echo "Building blog..."
    python3 build.py
    exit 0
else
    # Build the blog from markdown sources
    echo "Building blog..."
    python3 build.py

    # Start a local HTTP server on port 8000
    python3 -m http.server 8000

    echo "Server is running at http://localhost:8000" 
fi