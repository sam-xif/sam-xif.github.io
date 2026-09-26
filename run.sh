#!/bin/bash

# Navigate to the directory containing the website files
cd $(dirname "$0")

if [[ "$1" == "--build" ]]; then
    echo "Building blog..."
    python3 build.py
    exit 0
elif [[ "$1" == "--hot" ]]; then
    # Serve on port 8000, rebuilding (and reformatting) on post changes and
    # live-reloading open pages
    python3 devserver.py 8000
else
    # Build the blog from markdown sources
    echo "Building blog..."
    python3 build.py

    # Start a local HTTP server on port 8000
    python3 -m http.server 8000

    echo "Server is running at http://localhost:8000" 
fi