
  (() => {
    const schedule = document.getElementById("spaceSchedule");
    const board = document.getElementById("spaceScheduleBoard");
    if (!schedule || !board) return;
    const make = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text) el.textContent = text;
      return el;
    };
    const registrationUrl = value => {
      try {
        const url = new URL(value);
        const path = url.pathname.replace(/^\/|\/$/g, "");
        return url.protocol === "https:" && ["lu.ma", "luma.com"].includes(url.hostname)
          && path && !path.includes("/") && !["ai_mind_set", "discover", "home", "signin", "create", "calendar"].includes(path)
          && !path.startsWith("calendar-") ? url.href : null;
      } catch { return null; }
    };
    const dateFmt = new Intl.DateTimeFormat("ru-RU", {day:"numeric", month:"long", timeZone:"Europe/Moscow"});
    const timeFmt = new Intl.DateTimeFormat("ru-RU", {hour:"2-digit", minute:"2-digit", timeZone:"Europe/Moscow"});
    const notice = (title, note) => {
      board.replaceChildren();
      const el = make("div", "space-schedule__empty");
      const copy = make("div");
      copy.append(make("p", "space-schedule__empty-title", title), make("p", "space-schedule__empty-copy", note));
      el.append(make("span", "space-schedule__date", "ближайшая встреча"), copy);
      board.append(el);
    };
    const render = list => {
      const events = list.filter(event => event && Number.isFinite(Date.parse(event.start)) && Date.parse(event.start) > Date.now())
        .sort((a,b) => Date.parse(a.start) - Date.parse(b.start));
      if (!events.length) return notice("новых событий пока нет", "анонсы появляются по мере готовности встреч");
      board.replaceChildren();
      const row = event => {
        const el = make("article", "space-schedule__event");
        const at = new Date(event.start);
        const date = make("div", "space-schedule__date", dateFmt.format(at));
        date.append(make("span", "space-schedule__time", timeFmt.format(at) + " МСК"));
        const copy = make("div");
        copy.append(make("h4", "space-schedule__event-title", event.title || "встреча {space}"));
        if (event.note) copy.append(make("p", "space-schedule__event-note", event.note));
        el.append(date, copy);
        const href = registrationUrl(event.url);
        if (href) {
          const link = make("a", "space-schedule__action", "регистрация ↗");
          link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
          el.append(link);
        }
        return el;
      };
      events.slice(0, 2).forEach(event => board.append(row(event)));
      if (events.length <= 2) return;
      const tail = make("div");
      tail.id = "spaceScheduleMore"; tail.hidden = true;
      events.slice(2).forEach(event => tail.append(row(event)));
      const controls = make("div", "space-schedule__controls");
      const toggle = make("button", "space-schedule__toggle", "показать все анонсированные события");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", tail.id);
      toggle.addEventListener("click", () => {
        tail.hidden = !tail.hidden;
        toggle.setAttribute("aria-expanded", String(!tail.hidden));
        toggle.textContent = tail.hidden ? "показать все анонсированные события" : "скрыть дополнительные события";
      });
      controls.append(toggle);
      board.append(controls, tail);
    };
    notice("загружаем события", "ближайшие встречи {space} загружаются");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch(schedule.dataset.eventsApi || "/__events", {cache:"no-store", signal:controller.signal})
      .then(response => { if (!response.ok) throw new Error("Events unavailable"); return response.json(); })
      .then(data => {
        if (!Array.isArray(data.events)) throw new Error("Invalid events feed");
        render(data.events);
      })
      .catch(() => notice("не удалось загрузить события", "попробуйте обновить страницу позже"))
      .finally(() => clearTimeout(timeout));
  })();
  