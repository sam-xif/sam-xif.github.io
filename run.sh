#!/bin/bash

# Navigate to the directory containing the website files
cd $(dirname "$0")

# Start a local HTTP server on port 8000
python3 -m http.server 8000

echo "Server is running at http://localhost:8000" 