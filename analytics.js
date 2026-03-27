(function () {
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldndoeHFwamp5cG1seXd1cW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mjk2MDMsImV4cCI6MjA5MDEwNTYwM30.NySKh2F_3_-_kwnnCN8MohoFI0cRH3ly_bttTG8MDSg";

  fetch("https://tevwhxqpjjypmlywuqnu.supabase.co/functions/v1/log-site-visit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  }).catch(function () {});
})();
