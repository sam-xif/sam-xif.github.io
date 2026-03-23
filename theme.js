(function () {
    var stored = localStorage.getItem('blog-theme');
    if (stored) document.documentElement.setAttribute('data-theme', stored);
})();

document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('.theme-btn');
    var current = localStorage.getItem('blog-theme') || 'normal';

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('blog-theme', theme);
        buttons.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    setTheme(current);

    buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            setTheme(btn.dataset.theme);
        });
    });
});
