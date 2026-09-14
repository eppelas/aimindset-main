(() => {
  const objects = new Set(['wild/index.html', 'wild/ai-mindset-consulting/index.html', 'wild/non-profit/index.html']);
  const terminal = new Set(['published', 'superseded']);
  const states = new Set(['queued', 'importing', 'committed', 'publishing', 'error', ...terminal]);
  function identity(receipt) {
    const value = { object: receipt.object || document.querySelector('meta[name="aim-edit-object"]')?.content, rev: receipt.rev, sha: receipt.sha };
    if (!objects.has(value.object) || !Number.isSafeInteger(value.rev) || value.rev < 1 || !/^[a-f0-9]{16}$/.test(value.sha || '')) throw new Error('Не удалось определить сохранённую версию для GitHub.');
    return value;
  }
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, cache: 'no-store', signal: options.signal || AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Статус GitHub временно недоступен.');
    if (!states.has(data.state)) throw new Error('Сервер не подтвердил состояние синхронизации.');
    return data;
  }
  function watch(receipt, callback) {
    let stopped = false, timer, active, failures = 0;
    const started = Date.now();
    let id;
    try { id = identity(receipt); }
    catch (error) { callback({ state: 'error', error: error.message }); return () => {}; }
    async function poll() {
      active = new AbortController();
      const timeout = setTimeout(() => active.abort(), 15000);
      try {
        const data = await request('/__sync-status?' + new URLSearchParams(id), { signal: active.signal });
        if (stopped) return;
        if (data.object !== id.object || data.rev !== id.rev || data.sha !== id.sha) throw new Error('Сервер вернул статус другой версии.');
        failures = 0; callback(data);
        if (terminal.has(data.state)) return;
      } catch (error) {
        if (stopped) return;
        failures++;
        if (failures >= 3) { callback({ state: 'error', error: 'Текст сохранён в Google. Не удалось получить подтверждение GitHub: ' + error.message }); return; }
      } finally { clearTimeout(timeout); }
      if (Date.now() - started > 25 * 60000) { callback({ state: 'error', error: 'Текст сохранён. Подтверждение публикации пока не получено; проверьте запуск GitHub или повторите синхронизацию.' }); return; }
      if (!stopped) timer = setTimeout(poll, document.hidden ? 15000 : 5000);
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); active?.abort(); };
  }
  async function retry(receipt) {
    return request('/__sync-retry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(identity(receipt)) });
  }
  window.AIMEditorSync = Object.freeze({ watch, retry });
})();
