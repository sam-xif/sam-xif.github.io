/* Makes #-prefixed links land on their target even when it is inside a
   collapsed accordion: expand every enclosing <details>, then re-scroll. */
(function () {
    function revealHash() {
        var hash = window.location.hash;
        if (hash.length < 2) return;
        var target;
        try {
            target = document.getElementById(decodeURIComponent(hash.slice(1)));
        } catch (e) {
            return;
        }
        if (!target) return;

        var opened = false;
        var node = target.parentElement;
        while (node) {
            if (node.tagName === 'DETAILS' && !node.open) {
                node.open = true;
                opened = true;
            }
            node = node.parentElement;
        }
        if (opened) target.scrollIntoView();
    }

    window.addEventListener('hashchange', revealHash);
    document.addEventListener('DOMContentLoaded', revealHash);
})();
