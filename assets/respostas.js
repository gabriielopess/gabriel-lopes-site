(() => {
  let rows = [];
  const $ = s => document.querySelector(s);
  async function api(action, body) {
    const response = await fetch(`/api/presente?action=${action}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Não foi possível carregar.'); error.status = response.status; throw error; }
    return result;
  }
  function fail(error) { $('#error').textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Confira sua conexão e tente novamente.' : error.message; $('#error').hidden = false; }
  function render() {
    const query = $('#search').value.toLocaleLowerCase('pt-BR');
    const filtered = rows.filter(row => row.name.toLocaleLowerCase('pt-BR').includes(query));
    $('#list').replaceChildren();
    $('#count').textContent = `${rows.length} resposta${rows.length === 1 ? '' : 's'}`;
    if (!filtered.length) { const p = document.createElement('p'); p.textContent = rows.length ? 'Nenhum nome encontrado.' : 'Ainda não há respostas. Elas aparecerão aqui após o primeiro envio.'; p.style.marginTop = '24px'; $('#list').append(p); }
    for (const row of filtered) {
      const article = document.createElement('article'); article.className = 'response';
      const h2 = document.createElement('h2'); h2.textContent = row.name; article.append(h2);
      for (const value of [row.model === 'Feminino' ? 'Fem.' : 'Masc.', row.size]) { const span = document.createElement('span'); span.className = 'tag'; span.textContent = value; article.append(span); }
      article.title = `Recebida em ${new Date(row.createdAt).toLocaleString('pt-BR')}`;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'delete-response'; remove.title = 'Apagar resposta';
      const icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
      remove.innerHTML = icon;
      remove.setAttribute('aria-label', `Apagar resposta de ${row.name}`);
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Apagar a resposta de ${row.name}? Esta ação não pode ser desfeita.`)) return;
        remove.disabled = true; remove.textContent = '…'; $('#error').hidden = true;
        try {
          await api('delete', { id: row.id });
          rows = rows.filter(item => item.id !== row.id);
          render();
        } catch (error) {
          if (error.status === 401) locked();
          fail(error); remove.disabled = false; remove.innerHTML = icon;
        }
      });
      article.append(remove);
      $('#list').append(article);
    }
  }
  function locked() { rows = []; $('#list').replaceChildren(); $('#dashboard').hidden = true; $('#login').hidden = false; $('main').classList.remove('wide'); }
  async function load() {
    $('#error').hidden = true;
    try { const result = await api('responses'); rows = result.rows; $('#login').hidden = true; $('#dashboard').hidden = false; $('main').classList.add('wide'); render(); }
    catch (error) { if (error.status === 401) locked(); else fail(error); }
  }
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true; $('#error').hidden = true;
    try { await api('login', { username: $('#username').value.trim(), password: $('#password').value }); $('#password').value = ''; await load(); } catch (error) { fail(error); } finally { button.disabled = false; }
  });
  $('#logout').addEventListener('click', async () => { try { await api('logout', {}); locked(); } catch (error) { fail(error); } });
  $('#refresh').addEventListener('click', load);
  $('#search').addEventListener('input', render);
  load();
})();
