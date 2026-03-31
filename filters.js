(function () {
    var btns = document.querySelectorAll('.filter-btn');
    btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            btns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var filter = btn.dataset.filter;
            document.querySelectorAll('.post-listing').forEach(function (article) {
                article.style.display =
                    (filter === 'all' || article.dataset.category === filter) ? '' : 'none';
            });
        });
    });
})();
