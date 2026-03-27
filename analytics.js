(function () {
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldndoeHFwamp5cG1seXd1cW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mjk2MDMsImV4cCI6MjA5MDEwNTYwM30.NySKh2F_3_-_kwnnCN8MohoFI0cRH3ly_bttTG8MDSg";

  function logVisit(path, referrer) {
    fetch("https://tevwhxqpjjypmlywuqnu.supabase.co/functions/v1/log-site-visit", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        path: path,
        referrer: referrer,
        user_agent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }).catch(function () {});
  }

  logVisit(window.location.pathname, document.referrer || null);

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("a[href]").forEach(function (link) {
      const ext = link.pathname.split(".").pop().toLowerCase();
      if (["pdf", "png", "jpg", "jpeg", "gif", "zip"].includes(ext)) {
        link.addEventListener("click", function () {
          logVisit(link.pathname, window.location.pathname);
        });
      }
    });
  });
})();
