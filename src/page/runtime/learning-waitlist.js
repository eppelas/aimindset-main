
// ————— WAITLIST ТЕМАТИЧЕСКИХ СПРИНТОВ —————
(() => {
  const relay = "https://aim-pay-lead-relay-qpxb4cl6pq-uc.a.run.app/lead";
  const dialog = document.getElementById("waitlistDialog");
  const form = document.getElementById("waitlistForm");
  const topic = document.getElementById("waitlistTopic");
  const code = document.getElementById("waitlistCode");
  const telegram = document.getElementById("waitlistTelegram");
  const name = document.getElementById("waitlistName");
  const status = document.getElementById("waitlistStatus");
  const submit = document.getElementById("waitlistSubmit");
  const close = document.getElementById("waitlistClose");
  if (!dialog || !form || !topic || !code || !telegram || !name || !status || !submit || !close) return;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("is-error", error);
  }

  function openWaitlist(button) {
    topic.textContent = button.dataset.waitlistTopic || "тематический спринт";
    code.value = button.dataset.waitlistCode || "sprint";
    form.reset();
    code.value = button.dataset.waitlistCode || "sprint";
    setStatus("");
    button.focus({preventScroll:true});
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    requestAnimationFrame(() => telegram.focus({ preventScroll: true }));
  }

  document.addEventListener("click", event => {
    const button = event.target.closest(".waitlist-open");
    if (button && !document.body.classList.contains("editing")) openWaitlist(button);
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const rawTelegram = telegram.value.trim();
    const cleanTelegram = rawTelegram.replace(/^https?:\/\/(?:www\.)?t\.me\//i, "").replace(/^@+/, "");
    if (cleanTelegram.length < 3) {
      telegram.setCustomValidity("Укажите Telegram, по которому можно связаться");
      telegram.reportValidity();
      return;
    }
    telegram.setCustomValidity("");
    const cleanName = name.value.trim();
    submit.disabled = true;
    setStatus("отправляем…");
    try {
      const response = await fetch(relay, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          product_code: "waitlist." + code.value,
          contact_kind: "telegram",
          contact_value: cleanTelegram,
          contact_name: cleanName,
          lead_context: "waitlist",
          captured_at: new Date().toISOString(),
          capture_id: "waitlist:" + code.value + ":" + cleanTelegram + ":" + Date.now(),
          page_url: document.documentElement.dataset.waitlistPageUrl || location.href,
          referrer: document.referrer || "",
          traffic_type: "external"
        }),
        mode: "cors",
        credentials: "omit"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "request_failed");
      form.reset();
      setStatus("готово · напишем в Telegram");
    } catch {
      setStatus("не получилось отправить · попробуйте ещё раз", true);
    } finally {
      submit.disabled = false;
    }
  });
  telegram.addEventListener("input", () => telegram.setCustomValidity(""));
})();
