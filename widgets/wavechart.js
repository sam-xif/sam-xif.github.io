/* Renders ```wavechart fenced blocks as an interactive "waves of decline"
   chart: every tier's demand spikes together, then each tier falls away in
   turn, some months after (and more slowly than) the one before it. Scrubbing across the chart moves a crosshair,
   reads out every tier's value, and shows the note for that point in time.
   build.py only includes this script on posts that contain a wavechart block.

   Block syntax, one directive per line (fields separated by "|"):

       range: 2021-01 | 2030-01          x-axis span
       today: 2026-10                    solid line before, dashed after
       caption: Some text                shown under the chart
       spike: 2025-01 | 2026-04          shared run-up starts | peak
       tier:  Entry level | 2026-12 | 8   name | midpoint of fall | fall duration (months)
       note:  2022-09 | 0 | Title | Text  starts at | tier index or "all" | title | text

   A tier's fall is logistic toward zero; its duration is the time it takes to
   go from 90% to 10% of peak, so a shorter duration means a steeper fall.
   A note stays up from its start until the next note's start. Note text may
   use *emphasis*. Lines starting with "#" are ignored. */
(function () {
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var PRE_LEVEL = 70;               // demand before the spike, relative to peak
    var LOGISTIC_90_10 = 2 * Math.log(9);  // 90%->10% span of a unit-width logistic
    var MONTH = 1 / 12;

    function parseDate(s) {
        var m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(s.trim());
        if (!m) throw new Error('bad date "' + s + '" (want YYYY-MM)');
        return +m[1] + ((m[2] ? +m[2] : 1) - 1) / 12;
    }

    function formatDate(t) {
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var total = Math.round(t * 12);
        return months[((total % 12) + 12) % 12] + ' ' + Math.floor(total / 12);
    }

    function parseSpec(source) {
        var spec = { tiers: [], notes: [] };
        source.split('\n').forEach(function (line) {
            line = line.trim();
            if (!line || line[0] === '#') return;
            var colon = line.indexOf(':');
            if (colon < 0) throw new Error('missing ":" in "' + line + '"');
            var key = line.slice(0, colon).trim();
            var f = line.slice(colon + 1).split('|').map(function (s) { return s.trim(); });
            if (key === 'range') {
                spec.start = parseDate(f[0]);
                spec.end = parseDate(f[1]);
            } else if (key === 'caption') {
                spec.caption = f.join('|');
            } else if (key === 'today') {
                spec.today = parseDate(f[0]);
            } else if (key === 'spike') {
                spec.riseStart = parseDate(f[0]);
                spec.peak = parseDate(f[1]);
            } else if (key === 'tier') {
                spec.tiers.push({ name: f[0], mid: parseDate(f[1]), width: +f[2] / 12 / LOGISTIC_90_10 });
            } else if (key === 'note') {
                spec.notes.push({
                    at: parseDate(f[0]),
                    focus: f[1] === 'all' ? null : +f[1],
                    title: f[2],
                    text: f.slice(3).join('|')
                });
            } else {
                throw new Error('unknown directive "' + key + '"');
            }
        });
        if (spec.peak == null) throw new Error('missing "spike:" directive');
        spec.notes.sort(function (a, b) { return a.at - b.at; });
        return spec;
    }

    function demand(spec, tier, t) {
        if (t <= spec.peak) {
            var u = Math.min(1, Math.max(0, (t - spec.riseStart) / (spec.peak - spec.riseStart)));
            return PRE_LEVEL + (100 - PRE_LEVEL) * u * u * (3 - 2 * u);
        }
        var fall = function (x) { return 1 / (1 + Math.exp((x - tier.mid) / tier.width)); };
        return 100 * fall(t) / fall(spec.peak);
    }

    function el(name, attrs, parent) {
        var node = document.createElementNS(SVG_NS, name);
        for (var k in attrs) node.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(node);
        return node;
    }

    function html(tag, cls, parent) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (parent) parent.appendChild(node);
        return node;
    }

    function noteHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    function build(root, spec) {
        var legend = html('div', 'wc-legend', root);
        var chart = html('div', 'wc-chart', root);
        var panel = html('div', 'wc-note', root);
        panel.setAttribute('aria-live', 'polite');
        var noteDate = html('div', 'wc-note-date', panel);
        var noteTitle = html('div', 'wc-note-title', panel);
        var noteText = html('p', 'wc-note-text', panel);

        var readouts = spec.tiers.map(function (tier, i) {
            var item = html('span', 'wc-legend-item wc-tier-' + i, legend);
            html('span', 'wc-swatch', item);
            html('span', 'wc-legend-name', item).textContent = tier.name;
            return html('span', 'wc-legend-value', item);
        });

        if (spec.caption) html('figcaption', 'wc-caption', root).innerHTML = noteHtml(spec.caption);

        var current = spec.notes.length ? spec.notes[0].at : spec.start;
        var draw;

        function render() {
            var W = chart.clientWidth;
            if (!W) return;
            var H = Math.round(Math.min(340, Math.max(240, W * 0.55)));
            var m = { top: 26, right: 14, bottom: 34, left: 38 };
            var pw = W - m.left - m.right, ph = H - m.top - m.bottom;
            var x = function (t) { return m.left + (t - spec.start) / (spec.end - spec.start) * pw; };
            var yv = function (v) { return m.top + (1 - v / 100) * ph; };
            var tAt = function (px) {
                var t = spec.start + (px - m.left) / pw * (spec.end - spec.start);
                return Math.min(spec.end, Math.max(spec.start, Math.round(t * 12) / 12));
            };

            chart.innerHTML = '';
            var svg = el('svg', {
                width: W, height: H, viewBox: '0 0 ' + W + ' ' + H,
                tabindex: 0, role: 'img',
                'aria-label': 'Demand for software engineers by level over time. Use the arrow keys to move through time.'
            }, chart);

            // Grid and axes
            [0, 25, 50, 75, 100].forEach(function (v) {
                el('line', { class: 'wc-grid', x1: m.left, x2: m.left + pw, y1: yv(v), y2: yv(v) }, svg);
                el('text', { class: 'wc-axis-label', x: m.left - 8, y: yv(v), dy: '0.32em', 'text-anchor': 'end' }, svg).textContent = v;
            });
            el('line', { class: 'wc-baseline', x1: m.left, x2: m.left + pw, y1: yv(0), y2: yv(0) }, svg);
            var yearStep = pw < 380 ? 2 : 1;
            for (var yr = Math.ceil(spec.start); yr <= spec.end; yr += yearStep) {
                el('text', { class: 'wc-axis-label', x: x(yr), y: yv(0) + 20, 'text-anchor': 'middle' }, svg).textContent = yr;
            }

            // Projection region and "today" marker
            if (spec.today != null) {
                el('rect', { class: 'wc-future', x: x(spec.today), y: m.top, width: x(spec.end) - x(spec.today), height: ph }, svg);
                el('line', { class: 'wc-today', x1: x(spec.today), x2: x(spec.today), y1: m.top, y2: yv(0) }, svg);
                el('text', { class: 'wc-today-label', x: x(spec.today) - 4, y: m.top - 8 }, svg).textContent = 'Today → projection';
            }

            // Curves: solid through today, dashed after. Every tier follows the
            // same curve up to the peak, so that stretch is drawn once, neutral.
            var split = spec.today == null ? spec.end : Math.min(spec.end, spec.today);
            function path(tier, a, b) {
                var d = '';
                for (var t = a; t <= b + 1e-9; t += MONTH / 2) {
                    d += (d ? 'L' : 'M') + x(t).toFixed(1) + ',' + yv(demand(spec, tier, t)).toFixed(1);
                }
                return d;
            }
            function drawSegments(g, tier, a, b) {
                if (a < split) el('path', { class: 'wc-line', d: path(tier, a, Math.min(b, split)) }, g);
                if (b > split) el('path', { class: 'wc-line wc-projected', d: path(tier, Math.max(a, split), b) }, g);
            }
            drawSegments(el('g', { class: 'wc-series wc-shared' }, svg), spec.tiers[0], spec.start, spec.peak);
            var lines = spec.tiers.map(function (tier, i) {
                var g = el('g', { class: 'wc-series wc-tier-' + i }, svg);
                drawSegments(g, tier, spec.peak, spec.end);
                return g;
            });

            // Note markers along the baseline: clickable jump points
            spec.notes.forEach(function (note) {
                var mk = el('circle', { class: 'wc-marker', cx: x(note.at), cy: yv(0), r: 4 }, svg);
                mk.addEventListener('click', function () { draw(note.at); });
            });

            // Crosshair layer
            var cross = el('g', { class: 'wc-cross' }, svg);
            var hair = el('line', { class: 'wc-hair', y1: m.top, y2: yv(0) }, cross);
            var dots = spec.tiers.map(function (_, i) {
                return el('circle', { class: 'wc-dot wc-tier-' + i, r: 4.5 }, cross);
            });

            // Hit area: the whole plot, wider than any mark. Markers sit above it.
            var hit = el('rect', { class: 'wc-hit', x: m.left, y: 0, width: pw, height: H - m.bottom + 8 }, svg);
            svg.insertBefore(hit, svg.querySelector('.wc-marker') || cross);

            draw = function (t) {
                current = t;
                var note = null;
                spec.notes.forEach(function (n) { if (n.at <= t + 1e-9) note = n; });
                hair.setAttribute('x1', x(t));
                hair.setAttribute('x2', x(t));
                spec.tiers.forEach(function (tier, i) {
                    var v = demand(spec, tier, t);
                    dots[i].setAttribute('cx', x(t));
                    dots[i].setAttribute('cy', yv(v));
                    readouts[i].textContent = Math.round(v);
                    var dim = note && note.focus != null && note.focus !== i;
                    lines[i].classList.toggle('wc-dim', !!dim);
                    dots[i].classList.toggle('wc-dim', !!dim);
                    dots[i].classList.toggle('wc-shared', t <= spec.peak);
                });
                svg.querySelectorAll('.wc-marker').forEach(function (mk, j) {
                    mk.classList.toggle('wc-active', spec.notes[j] === note);
                });
                noteDate.textContent = formatDate(t) + (spec.today != null && t > spec.today ? ' · projected' : '');
                noteTitle.textContent = note ? note.title : '';
                noteText.innerHTML = note ? noteHtml(note.text) : 'Drag across the chart to move through time.';
            };

            function fromPointer(e) {
                var r = svg.getBoundingClientRect();
                draw(tAt(e.clientX - r.left));
            }
            hit.addEventListener('pointerdown', function (e) {
                hit.setPointerCapture(e.pointerId);
                fromPointer(e);
            });
            hit.addEventListener('pointermove', function (e) {
                if (e.pointerType === 'mouse' || hit.hasPointerCapture(e.pointerId)) fromPointer(e);
            });
            svg.addEventListener('keydown', function (e) {
                var step = { ArrowRight: MONTH, ArrowLeft: -MONTH, PageUp: 1, PageDown: -1 }[e.key];
                if (e.key === 'Home') step = spec.start - current;
                if (e.key === 'End') step = spec.end - current;
                if (step == null) return;
                e.preventDefault();
                draw(Math.min(spec.end, Math.max(spec.start, Math.round((current + step) * 12) / 12)));
            });

            draw(current);
        }

        render();
        if (window.ResizeObserver) {
            var lastW = chart.clientWidth;
            new ResizeObserver(function () {
                if (chart.clientWidth !== lastW) { lastW = chart.clientWidth; render(); }
            }).observe(chart);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('pre > code.language-wavechart').forEach(function (code) {
            var root = document.createElement('figure');
            root.className = 'wavechart';
            code.parentElement.replaceWith(root);
            try {
                build(root, parseSpec(code.textContent));
            } catch (err) {
                root.textContent = 'Chart error: ' + err.message;
            }
        });
    });
})();
