#!/bin/sh

mkdir -p ruby-lean
cp ~/code/ruby-lean/playground/dist.tar.gz .
tar --strip-components=1 -xzf dist.tar.gz -C ruby-lean
rm dist.tar.gz

# Patch in a "back to samx.io" link at the top left of the header.
cat > /tmp/homelink.css <<'CSS'
<style>
  header .homelink { display:inline-flex; align-items:center; gap:6px;
    color:var(--dim); text-decoration:none; font:500 12.5px/1 var(--sans);
    padding:5px 10px; border:1px solid var(--edge2); border-radius:7px;
    background:var(--panel2); white-space:nowrap;
    transition:color .12s ease, border-color .12s ease; }
  header .homelink:hover { color:var(--fg); border-color:var(--dim); }
  header .homelink .arrow { color:var(--dimmer); font-size:13px; }
</style>
CSS

cat > /tmp/homelink.html <<'HTML'
  <a class="homelink" href="https://samx.io/"><span class="arrow">&#8592;</span>samx.io</a>
HTML

awk '
  /<\/head>/ && !css { while ((getline l < "/tmp/homelink.css") > 0) print l; css=1 }
  { print }
  /<header>/ && !link { while ((getline l < "/tmp/homelink.html") > 0) print l; link=1 }
' ruby-lean/index.html > /tmp/index.patched.html

mv /tmp/index.patched.html ruby-lean/index.html
rm -f /tmp/homelink.css /tmp/homelink.html
