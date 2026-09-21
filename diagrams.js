/* Renders ```mermaid fenced blocks as diagrams. Colors come from the blog's
   CSS variables, so diagrams re-render whenever the theme switcher changes
   data-theme on <html>. build.py only includes this script on posts that
   contain a mermaid block. */
(function () {
    var MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function themeVariables() {
        return {
            background: cssVar('--bg'),
            primaryColor: cssVar('--code-bg'),
            primaryTextColor: cssVar('--text'),
            primaryBorderColor: cssVar('--border-strong'),
            secondaryColor: cssVar('--th-bg'),
            tertiaryColor: cssVar('--bg'),
            lineColor: cssVar('--text-muted'),
            textColor: cssVar('--text'),
            clusterBkg: cssVar('--bg'),
            clusterBorder: cssVar('--text-muted'),
            edgeLabelBackground: cssVar('--bg'),
            fontFamily: getComputedStyle(document.body).fontFamily
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        var blocks = document.querySelectorAll('pre > code.language-mermaid');
        if (!blocks.length) return;

        // Swap each <pre> for a container, keeping the diagram source around
        // so it can be re-rendered on theme change.
        var diagrams = Array.prototype.map.call(blocks, function (code) {
            var div = document.createElement('div');
            div.className = 'mermaid-diagram';
            div.dataset.source = code.textContent;
            code.parentElement.replaceWith(div);
            return div;
        });

        import(MERMAID_URL).then(function (module) {
            var mermaid = module.default;
            var renderCount = 0;

            function renderAll() {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'base',
                    themeVariables: themeVariables()
                });
                diagrams.forEach(function (div) {
                    var id = 'mermaid-' + renderCount++;
                    mermaid.render(id, div.dataset.source).then(function (result) {
                        div.innerHTML = result.svg;
                    }).catch(function (err) {
                        div.textContent = 'Diagram error: ' + err.message;
                    });
                });
            }

            renderAll();
            new MutationObserver(renderAll).observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        });
    });
})();
