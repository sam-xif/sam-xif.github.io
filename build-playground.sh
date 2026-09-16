#!/bin/sh

mkdir -p ruby-lean
cp ~/code/ruby-lean/playground/dist.tar.gz .
tar --strip-components=1 -xzf dist.tar.gz -C ruby-lean
rm dist.tar.gz
