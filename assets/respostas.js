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
      for (const value of [row.model, row.size]) { const span = document.createElement('span'); span.className = 'tag'; span.textContent = value; article.append(span); }
      const time = document.createElement('time'); time.dateTime = row.createdAt; time.textContent = new Date(row.createdAt).toLocaleString('pt-BR'); article.append(time);
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
