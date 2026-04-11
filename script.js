const API_URL = "https://script.google.com/macros/s/AKfycbz5Twl62Dv-f42fDtKzUl8TcL_WWkiI5ako3EOFXRS1Jt4kqOB97-ZexR2XkxUQAC2a/exec";

let idEditando = null; let idComprando = null; let nomeComprando = null;
let dadosPixNuvem = { chave: "", qr: "" };
let grupoRSVP = { nomes: "", identificacao: "", categoriasStr: "" };

window.listaPresencasGlobais = []; window.estatisticasGlobais = { totalConvidados: 0, totalGrupos: 0, listaOficial: [] };
window.dadosDetalhesDash = {};
let linhaRsvpEditando = null; let linhaGrupoEditando = null;

// Variáveis do Mapa de Mesas
let layoutMesas = []; let todosConvidadosArray = []; let modoListaMesas = false; let idMesaSendoEditada = null;let filtroLadoAtual = "TODOS";

window.onload = function () {
    if (!localStorage.getItem('credenciaisAdmin')) localStorage.setItem('credenciaisAdmin', JSON.stringify({ user: 'admin', pass: 'admin' }));
    if (sessionStorage.getItem('logadoComoAdmin') === 'sim') document.getElementById('corpo-site').classList.add('modo-admin-ativo');
    carregarListaDaPlanilha();
};

const setHtmlSafe = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
const setTextSafe = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

function processarDadosPlanilha(dados) {
    const grid = document.getElementById('grid-presentes');
    if (grid) grid.innerHTML = "";
    const isAdmin = sessionStorage.getItem('logadoComoAdmin') === 'sim';

    if (dados.pix) { dadosPixNuvem.chave = dados.pix.chave || ""; dadosPixNuvem.qr = dados.pix.qr || ""; }
    if (dados.presencas) window.listaPresencasGlobais = dados.presencas;
    if (dados.estatisticas) window.estatisticasGlobais = dados.estatisticas;
    if (dados.mesas && dados.mesas !== "[]") { try { layoutMesas = JSON.parse(dados.mesas); } catch (e) { layoutMesas = []; } }

    if (dados.presentes.length === 0) { if (grid) grid.innerHTML = "<p class='loading'>A lista está vazia!</p>"; return; }
    let itensRenderizados = 0;
    dados.presentes.forEach(p => {
        if (!p.id || !p.nome) return;
        const statusNorm = p.status ? p.status.trim().toUpperCase() : "";
        const taOculto = statusNorm === 'COMPRADO' || statusNorm === 'EXCLUIDO';
        if (!isAdmin && taOculto) return;
        itensRenderizados++;
        let valorLimpo = String(p.valor).replace('R$', '').trim(); if (!valorLimpo.includes(',')) valorLimpo = valorLimpo + ",00";
        let estiloCard = ""; let seloHtml = ""; let botaoAcaoHtml = `<button class="btn-elegante" onclick="abrirModalPix('${p.id}', '${p.nome}', '${valorLimpo}')">Presentear</button>`;
        if (isAdmin && taOculto) {
            estiloCard = "opacity: 0.6; filter: grayscale(50%); border: 2px dashed #ccc;";
            if (statusNorm === 'COMPRADO') seloHtml = `<div class="selo-status selo-comprado">🎁 COMPRADO</div>`; else seloHtml = `<div class="selo-status">🚫 EXCLUÍDO</div>`;
            botaoAcaoHtml = `<button class="btn-restaurar" onclick="mudarStatusPresente('${p.id}', event)">🔄 Restaurar</button>`;
        }
        if (grid) grid.insertAdjacentHTML('beforeend', `<div class="item-lista" id="${p.id}" style="${estiloCard}">${seloHtml}<div class="botoes-admin somente-admin"><button class="btn-editar" onclick="abrirModalEditar('${p.id}', '${p.nome}', '${valorLimpo}', '${p.imagem}')">✏️</button><button class="btn-excluir" onclick="excluirPresente('${p.id}', event)">🗑️</button></div><div class="vitrine-produto"><img src="${p.imagem}" alt="${p.nome}"><div class="info-item"><h3>${p.nome}</h3><span class="valor">Cota: R$ ${valorLimpo}</span></div></div>${botaoAcaoHtml}</div>`);
    });
    if (itensRenderizados === 0 && !isAdmin && grid) grid.innerHTML = "<p class='loading'>Todos os itens da lista já foram comprados! Muito obrigado.</p>";
}

function carregarListaDaPlanilha() {
    setHtmlSafe('grid-presentes', '<div class="loading" id="mensagem-loading">⏳ Sincronizando com a base de dados...</div>');
    fetch(API_URL).then(res => res.json()).then(dados => processarDadosPlanilha(dados)).catch(erro => { setHtmlSafe('grid-presentes', "<p class='loading' style='color:red;'>Erro de conexão. Recarregue.</p>"); });
}


// ========================================================
// 🪑 SISTEMA DE MAPA DE MESAS (SEATING PLAN) ATUALIZADO
// ========================================================
function abrirModalMesas() {
    extrairTodosConvidados();
    renderizarPaineisMesas();
    abrirModal('modal-mesas');
}

function extrairTodosConvidados() {
    todosConvidadosArray = [];
    let confirmadosMap = {};
    window.listaPresencasGlobais.forEach(p => {
        if (p.jsonRaw && p.jsonRaw !== "[]") {
            try {
                let membros = JSON.parse(p.jsonRaw);
                membros.forEach(m => {
                    if (m.status) confirmadosMap[p.grupo + "|||" + m.nome.trim().toLowerCase()] = true;
                });
            } catch (e) { }
        } else {
            let confirmadosAntigos = p.confirmados.split("|").map(s => s.trim().split(" (")[0].toLowerCase());
            confirmadosAntigos.forEach(c => confirmadosMap[p.grupo + "|||" + c] = true);
        }
    });

    let listaOficial = window.estatisticasGlobais.listaOficial || [];
    listaOficial.forEach(g => {
        let membrosLidos = [];
        if (g.categoriasStr && g.categoriasStr.startsWith("[")) {
            try { membrosLidos = JSON.parse(g.categoriasStr); } catch (e) { }
        } else {
            let nomes = g.membros.split(/,\s*|\s+e\s+/i).filter(n => n.trim().length > 0);
            membrosLidos = nomes.map(n => ({ nome: n }));
        }

        membrosLidos.forEach(m => {
            let nomeKey = g.identificacao + "|||" + m.nome.trim().toLowerCase();
            let idStrOriginal = g.identificacao + "|||" + m.nome.trim();
            let isConf = confirmadosMap[nomeKey] === true;

            todosConvidadosArray.push({
                idStr: idStrOriginal,
                grupo: g.identificacao,
                nome: m.nome.trim(),
                confirmado: isConf,
                lado: (g.lado || "TODOS").toUpperCase() // ADICIONADO AQUI
            });
        });
    });
}

function renderizarPaineisMesas() {
    const painelEsq = document.getElementById('lista-arrastavel-convidados');
    const painelMap = document.getElementById('area-mapa-mesas');
    if (!painelEsq || !painelMap) return;

    painelEsq.innerHTML = ""; painelMap.innerHTML = "";


    let convidadosFiltrados = todosConvidadosArray.filter(c => {
        if (filtroLadoAtual === "TODOS") return true;
        return c.lado === filtroLadoAtual;
    });

    let gruposDict = {};
    convidadosFiltrados.forEach(c => {
        if (!gruposDict[c.grupo]) gruposDict[c.grupo] = [];
        gruposDict[c.grupo].push(c);
    });

    for (const [nomeGrupo, listaPessoas] of Object.entries(gruposDict)) {
        let countAlocados = 0; let htmlPessoas = "";
        let grupoIdStr = "GRUPO|||" + nomeGrupo;
        let membrosLivres = 0;

        listaPessoas.forEach(pessoa => {
            let taAlocado = pessoaEstaEmMesa(pessoa.idStr);
            if (taAlocado) countAlocados++; else membrosLivres++;

            let strAlocado = taAlocado ? "alocado" : "";
            let iconeConf = pessoa.confirmado ? '<span title="Confirmado">✅</span>' : '<span title="Pendente">⏳</span>';
            let dragAttr = taAlocado ? "" : `draggable="true" ondragstart="dragInicia(event, '${pessoa.idStr}', false)"`;
            let iconDrag = taAlocado ? "📌" : "⣿";

            htmlPessoas += `<div class="convidado-arrastavel ${strAlocado}" ${dragAttr}><span>${iconeConf} ${pessoa.nome}</span> <span>${iconDrag}</span></div>`;
        });

        let corGrupo = countAlocados === listaPessoas.length ? "#e8f5e9" : "#fff";
        let btnTxtCor = countAlocados === listaPessoas.length ? "#2e7d32" : "#333";
        let dragAttrGrupo = membrosLivres > 0 ? `draggable="true" ondragstart="dragInicia(event, '${grupoIdStr}', true)"` : "";
        let iconDragGrupo = membrosLivres > 0 ? " ⣿" : "";

        const htmlGrupo = `
                <div class="grupo-sanfona" style="background:${corGrupo}">
                    <button class="grupo-sanfona-btn" ${dragAttrGrupo} onclick="this.nextElementSibling.classList.toggle('aberto')" style="color:${btnTxtCor}">
                        ${nomeGrupo} (${countAlocados}/${listaPessoas.length})${iconDragGrupo} <span>▼</span>
                    </button>
                    <div class="grupo-sanfona-conteudo">${htmlPessoas}</div>
                </div>`;
        painelEsq.insertAdjacentHTML('beforeend', htmlGrupo);
    }

    layoutMesas.forEach(mesa => {
        let raio = 95;
        let htmlCadeiras = "";

        for (let i = 0; i < mesa.assentos; i++) {
            let angulo = (i / mesa.assentos) * (2 * Math.PI) - (Math.PI / 2);
            let left = 140 + raio * Math.cos(angulo) - 37.5;
            let top = 140 + raio * Math.sin(angulo) - 17.5;

            if (i < mesa.convidados.length) {
                let c = mesa.convidados[i];
                let pReal = todosConvidadosArray.find(tc => tc.idStr === c.idStr);
                let iconeMesa = (pReal && pReal.confirmado) ? "✅ " : "⏳ ";
                let formatNome = c.nome.split(' ')[0];
                if (formatNome.length > 10) formatNome = formatNome.substring(0, 8) + '..';

                // O "X" para remover individual
                htmlCadeiras += `
                        <div class="assento-mesa" draggable="true" ondragstart="dragInicia(event, '${c.idStr}', false, true)" style="left: ${left}px; top: ${top}px;" title="${c.nome} (${c.grupo})">
                            <span style="font-size:0.65rem;">${iconeMesa}</span> ${formatNome}
                            <span class="remover-assento" onclick="removerConvidadoDaMesa(${mesa.id}, '${c.idStr}', '${c.nome}')" title="Remover da mesa">✖</span>
                        </div>`;
            } else {
                htmlCadeiras += `<div class="assento-mesa assento-vazio" style="left: ${left}px; top: ${top}px;">Vazio</div>`;
            }
        }

        // Botão de Excluir a Mesa
        let btnRemover = `<button class="del" onclick="removerMesa(${mesa.id})" title="Excluir Mesa">✖ Apagar Mesa</button>`;

        const htmlMesa = `
                <div class="mesa-wrapper">
                    ${htmlCadeiras}
                    <div class="mesa-centro" ondragover="dragSobre(event)" ondragleave="dragSai(event)" ondrop="dragSolta(event, ${mesa.id})">
                        <h4>Mesa ${mesa.id}</h4>
                        <div style="font-size:0.85rem; color:#666; display:flex; align-items:center; gap:8px; margin-top: 5px;">
                            <button class="btn-lugar" onclick="alterarAssentosMesa(${mesa.id}, -1)" title="Remover assento">-</button>
                            <strong>${mesa.convidados.length}/${mesa.assentos}</strong>
                            <button class="btn-lugar" onclick="alterarAssentosMesa(${mesa.id}, 1)" title="Adicionar assento">+</button>
                        </div>
                    </div>
                    <div class="mesa-btn-acoes">
                        <button class="edit" onclick="abrirModalPreencherMesa(${mesa.id})" title="Preencher por lista">✏️ Preencher</button>
                        ${btnRemover}
                    </div>
                </div>`;
        painelMap.insertAdjacentHTML('beforeend', htmlMesa);
    });
}

function pessoaEstaEmMesa(idStr) { for (let m of layoutMesas) { if (m.convidados.find(c => c.idStr === idStr)) return true; } return false; }

function adicionarMesa(forcarAssentos = 0) {
    let selectElem = document.getElementById('qtd-assentos-nova-mesa');
    let assentos = forcarAssentos > 0 ? forcarAssentos : (selectElem ? parseInt(selectElem.value) : 8);
    let novoId = layoutMesas.length > 0 ? Math.max(...layoutMesas.map(m => m.id)) + 1 : 1;
    layoutMesas.push({ id: novoId, assentos: assentos, convidados: [] });
    renderizarPaineisMesas();
    return novoId;
}

function limparTodasMesas() {
    if (confirm("ATENÇÃO: Deseja apagar TODAS as mesas? Todos os convidados ficarão sem lugar.")) {
        layoutMesas = [];
        renderizarPaineisMesas();
    }
}

function removerMesa(idMesa) {
    if (confirm("Deseja excluir esta mesa? Os convidados sentados nela perderão o lugar e voltarão para a lista.")) {
        layoutMesas = layoutMesas.filter(m => m.id !== idMesa);
        renderizarPaineisMesas();
    }
}

function alterarAssentosMesa(idMesa, delta) {
    let mesa = layoutMesas.find(m => m.id === idMesa);
    if (mesa) {
        let novo = mesa.assentos + delta;
        if (novo >= mesa.convidados.length && novo >= 6 && novo <= 12) {
            mesa.assentos = novo;
            renderizarPaineisMesas();
        } else if (novo > 12) {
            alert("O máximo de assentos por mesa é 12.");
        } else if (novo < 6) {
            alert("O mínimo de assentos por mesa é 6.");
        } else if (novo < mesa.convidados.length) {
            alert("Remova convidados da mesa antes de diminuir os assentos.");
        }
    }
}

function removerConvidadoDaMesa(idMesa, idStr, nome) {
    let mesa = layoutMesas.find(m => m.id === idMesa);
    if (mesa) {
        mesa.convidados = mesa.convidados.filter(c => c.idStr !== idStr);
        renderizarPaineisMesas();
    }
}

function alternarVisualizacaoMesas() {
    modoListaMesas = !modoListaMesas;
    const container = document.getElementById('area-mapa-mesas'); const btn = document.getElementById('btn-toggle-mesas');
    if (modoListaMesas) { container.classList.add('modo-lista-mesas'); btn.innerText = "Ver em Mapa"; }
    else { container.classList.remove('modo-lista-mesas'); btn.innerText = "Ver em Lista"; }
}

function dragInicia(ev, idStr, isGrupo = false, isDaMesa = false) {
    ev.dataTransfer.setData("textoIdStr", idStr);
    ev.dataTransfer.setData("isGrupo", isGrupo);
    ev.dataTransfer.setData("isDaMesa", isDaMesa);
}
function dragSobre(ev) { ev.preventDefault(); ev.currentTarget.classList.add('arrastando-sobre'); }
function dragSai(ev) { ev.currentTarget.classList.remove('arrastando-sobre'); }

function dragSolta(ev, idMesa) {
    ev.preventDefault(); ev.currentTarget.classList.remove('arrastando-sobre');
    let idStr = ev.dataTransfer.getData("textoIdStr");
    let isGrupo = ev.dataTransfer.getData("isGrupo") === "true";
    let isDaMesa = ev.dataTransfer.getData("isDaMesa") === "true";

    if (isGrupo) {
        let nomeGrupoReal = idStr.split("|||")[1];
        processarAdicaoGrupoMesa(idMesa, nomeGrupoReal);
    } else {
        if (isDaMesa) removerPessoaDeQualquerMesa(idStr);
        processarAdicaoMesaIndividual(idMesa, idStr);
    }
}

function removerPessoaDeQualquerMesa(idStr) {
    layoutMesas.forEach(m => { m.convidados = m.convidados.filter(c => c.idStr !== idStr); });
}

function processarAdicaoMesaIndividual(idMesa, idStr) {
    let mesa = layoutMesas.find(m => m.id === idMesa);
    if (mesa.convidados.length >= mesa.assentos) return alert("Mesa cheia!");
    if (pessoaEstaEmMesa(idStr)) return alert("Pessoa já está em uma mesa.");
    let pessoa = todosConvidadosArray.find(c => c.idStr === idStr);
    if (pessoa) { mesa.convidados.push(pessoa); renderizarPaineisMesas(); }
}

function processarAdicaoGrupoMesa(idMesaAlvo, nomeGrupo) {
    let mesa = layoutMesas.find(m => m.id === idMesaAlvo);
    let pessoasLivresDoGrupo = todosConvidadosArray.filter(c => c.grupo === nomeGrupo && !pessoaEstaEmMesa(c.idStr));
    if (pessoasLivresDoGrupo.length === 0) return alert("Todos do grupo já estão alocados.");

    let assentosRestantes = mesa.assentos - mesa.convidados.length;
    let transbordoCriado = false;

    while (pessoasLivresDoGrupo.length > 0) {
        if (assentosRestantes === 0) {
            let selObj = document.getElementById('qtd-assentos-nova-mesa');
            let assentosPadrao = selObj ? parseInt(selObj.value) : 8;
            let novoIdMesa = adicionarMesa(assentosPadrao);
            mesa = layoutMesas.find(m => m.id === novoIdMesa);
            assentosRestantes = mesa.assentos;
            transbordoCriado = true;
        }
        let pessoaAtual = pessoasLivresDoGrupo.shift();
        mesa.convidados.push(pessoaAtual);
        assentosRestantes--;
    }

    if (transbordoCriado) alert("O grupo era maior que a mesa! Novas mesas foram criadas automaticamente para acomodar todos.");
    renderizarPaineisMesas();
}

function abrirModalPreencherMesa(idMesa) {
    idMesaSendoEditada = idMesa;
    let mesa = layoutMesas.find(m => m.id === idMesa);
    setTextSafe('titulo-selecao-mesa', "Editando Mesa " + idMesa);
    setTextSafe('vagas-restantes-mesa', (mesa.assentos - mesa.convidados.length));
    const container = document.getElementById('lista-checkbox-mesas');
    if (container) container.innerHTML = "";

    let gruposDict = {};
    todosConvidadosArray.forEach(c => { if (!gruposDict[c.grupo]) gruposDict[c.grupo] = []; gruposDict[c.grupo].push(c); });

    for (const [nomeGrupo, listaPessoas] of Object.entries(gruposDict)) {
        let htmlChecks = ""; let temAlguemLivre = false;
        listaPessoas.forEach(p => {
            let taNestaMesa = mesa.convidados.find(mc => mc.idStr === p.idStr);
            let taEmOutraMesa = pessoaEstaEmMesa(p.idStr) && !taNestaMesa;
            if (!taEmOutraMesa) {
                temAlguemLivre = true; let checkd = taNestaMesa ? "checked" : "";
                let iconeConf = p.confirmado ? "✅" : "⏳";
                htmlChecks += `<label style="display:flex; gap:10px; padding:5px 0; margin-left:15px; cursor:pointer;"><input type="checkbox" class="cb-preencher-mesa" value="${p.idStr}" ${checkd} style="width:18px; height:18px;"> ${iconeConf} ${p.nome}</label>`;
            }
        });
        if (temAlguemLivre && container) container.insertAdjacentHTML('beforeend', `<div style="margin-bottom:10px; background:#f9f9f9; padding:10px; border-radius:4px;"><strong style="color:#8c7b65;">${nomeGrupo}</strong>${htmlChecks}</div>`);
    }
    if (container && container.innerHTML === "") container.innerHTML = "<p>Não há convidados livres.</p>";

    fecharModal('modal-mesas');
    abrirModal('modal-selecionar-convidados-mesa');
}

function salvarSelecaoMesa() {
    let mesa = layoutMesas.find(m => m.id === idMesaSendoEditada);
    let checks = document.querySelectorAll('.cb-preencher-mesa'); let selecionadosIdStr = [];
    checks.forEach(cb => { if (cb.checked) selecionadosIdStr.push(cb.value); });
    if (selecionadosIdStr.length > mesa.assentos) return alert("Selecionou mais pessoas do que a mesa suporta!");
    mesa.convidados = [];
    selecionadosIdStr.forEach(idStr => { let p = todosConvidadosArray.find(c => c.idStr === idStr); if (p) mesa.convidados.push(p); });

    fecharModal('modal-selecionar-convidados-mesa');
    renderizarPaineisMesas();
    abrirModal('modal-mesas');
}

function salvarMapaMesasNuvem() {
    const btn = document.getElementById('btn-salvar-mesas'); btn.innerText = "⏳ Salvando..."; btn.disabled = true;
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "salvarMesas", layout: JSON.stringify(layoutMesas) }) })
        .then(() => alert("Mapa de Mesas salvo na nuvem com sucesso!")).catch(() => alert("Erro ao salvar.")).finally(() => { btn.innerText = "💾 Salvar Mapa"; btn.disabled = false; });
}

// Função de Autopreenchimento para o Mapa de Mesas
function preencherMesasAutomatico() {
    if (!confirm("Deseja criar mesas e distribuir TODOS os convidados separando por Lado?")) return;

    // 1. Limpar mesas atuais para uma distribuição do zero (opcional, mas recomendado para evitar erro)
    layoutMesas = [];

    // 2. Separar convidados por Lado e depois por Grupo
    const separarPorLadoEGrupo = (lista) => {
        return lista.reduce((acc, conv) => {
            const lado = (conv.lado || "OUTROS").toUpperCase();
            if (!acc[lado]) acc[lado] = {};
            if (!acc[lado][conv.grupo]) acc[lado][conv.grupo] = [];
            acc[lado][conv.grupo].push(conv);
            return acc;
        }, {});
    };

    const mapaLados = separarPorLadoEGrupo(todosConvidadosArray);
    const assentosPorMesa = parseInt(document.getElementById('qtd-assentos-nova-mesa').value) || 8;

    // 3. Função para processar cada lado separadamente
    const distribuirLado = (gruposDoLado) => {
        let mesaAtualId = adicionarMesa(assentosPorMesa);
        let mesaAtual = layoutMesas.find(m => m.id === mesaAtualId);

        for (const nomeGrupo in gruposDoLado) {
            const membrosGrupo = gruposDoLado[nomeGrupo];
            let vagas = mesaAtual.assentos - mesaAtual.convidados.length;

            // Se o grupo inteiro não cabe na mesa atual, cria uma nova mesa ANTES de começar a colocar
            // Isso evita misturar muito, mas se o grupo for maior que a mesa, ele transborda
            if (membrosGrupo.length > vagas && mesaAtual.convidados.length > 0) {
                mesaAtualId = adicionarMesa(assentosPorMesa);
                mesaAtual = layoutMesas.find(m => m.id === mesaAtualId);
                vagas = mesaAtual.assentos;
            }

            membrosGrupo.forEach(pessoa => {
                if (mesaAtual.convidados.length >= mesaAtual.assentos) {
                    mesaAtualId = adicionarMesa(assentosPorMesa);
                    mesaAtual = layoutMesas.find(m => m.id === mesaAtualId);
                }
                mesaAtual.convidados.push(pessoa);
            });
        }
    };

    // 4. Executa a distribuição por Lado (Garante que nunca misture Lados na mesma mesa)
    if (mapaLados["NOIVO"]) distribuirLado(mapaLados["NOIVO"]);
    if (mapaLados["NOIVA"]) distribuirLado(mapaLados["NOIVA"]);
    if (mapaLados["OUTROS"]) distribuirLado(mapaLados["OUTROS"]);
    if (mapaLados["TODOS"]) distribuirLado(mapaLados["TODOS"]);

    renderizarPaineisMesas();
    alert("Mesas criadas e convidados distribuídos por lado com sucesso!");
}

// --- GERENCIAR LISTA DE CONVIDADOS ---
function abrirModalListaConvidados() {
    const container = document.getElementById('conteudo-lista-convidados');
    if (container) container.innerHTML = "";
    if (!window.estatisticasGlobais.listaOficial || window.estatisticasGlobais.listaOficial.length === 0) { if (container) container.innerHTML = "<p style='text-align:center; color:#888;'>A sua lista está vazia.</p>"; }
    else {
        window.estatisticasGlobais.listaOficial.forEach((g, indexOriginalArray) => {
            let membrosLidos = []; if (g.categoriasStr && g.categoriasStr.startsWith("[")) { try { membrosLidos = JSON.parse(g.categoriasStr); } catch (e) { } }
            let membrosHtml = "";
            if (membrosLidos.length > 0) {
                membrosLidos.forEach(m => { let tag = m.categoria !== "Convidado" ? `<span class="tag-categoria">${m.categoria}</span>` : ""; let tagIdade = m.tipo === "Criança" ? `<span style="font-size:0.75rem; color:#1976d2;">(👶 ${m.idade || '0'} a.)</span>` : ""; membrosHtml += `<span style="display:inline-block; margin-right:10px; margin-bottom:5px;">${m.nome} ${tag} ${tagIdade}</span>`; });
            } else { membrosHtml = g.membros; }

            if (container) container.insertAdjacentHTML('beforeend', `
                    <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 6px; margin-bottom: 15px; background: #fff; display: flex; justify-content: space-between; gap: 15px; align-items: flex-start; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px;">
                            <h4 style="color: #333; margin-bottom: 8px; font-size: 1.1rem;">${g.identificacao}</h4>
                            <div style="font-size: 0.95rem; color:#555;">${membrosHtml}</div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="prepararEdicaoGrupo(${indexOriginalArray})" style="background: #1976d2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition:0.3s; height: fit-content;">✏️ Editar</button>
                            <button onclick="excluirGrupoDaLista(${g.linha}, this)" style="background: #d32f2f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition:0.3s; height: fit-content;">🗑️ Apagar</button>
                        </div>
                    </div>`);
        });
    }
    abrirModal('modal-lista-convidados');
}
function excluirGrupoDaLista(linha, btn) { if (confirm("Apagar permanentemente da sua lista oficial?")) { const card = btn.parentElement.parentElement; btn.innerText = "..."; btn.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "excluirGrupoConvidado", linha: linha }) }).then(() => { card.remove(); fetch(API_URL).then(r => r.json()).then(dados => processarDadosPlanilha(dados)); }).catch(() => { alert("Erro."); btn.disabled = false; btn.innerText = "🗑️ Apagar"; }); } }
function toggleIdadeAdmin(sel) { const inputIdade = sel.parentElement.querySelector('.input-idade-membro'); if (sel.value === 'Criança') { inputIdade.style.display = 'block'; } else { inputIdade.style.display = 'none'; inputIdade.value = ''; } }
function adicionarLinhaMembro() { const c = document.getElementById('container-novos-membros'); if (c) c.insertAdjacentHTML('beforeend', `<div class="linha-novo-membro" style="display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;"><input type="text" class="input-nome-membro" placeholder="Nome" style="flex: 2; min-width: 120px; padding: 8px;"><select class="select-cat-membro" style="flex: 1.5; padding: 8px; min-width: 100px;"><option value="Convidado">Convidado</option><option value="Padrinho">Padrinho</option><option value="Madrinha">Madrinha</option><option value="Noivinho">Noivinho</option><option value="Noivinha">Noivinha</option><option value="Florista">Florista</option><option value="Pajem">Pajem</option></select><select class="select-tipo-membro" onchange="toggleIdadeAdmin(this)" style="flex: 1; padding: 8px; min-width: 90px;"><option value="Adulto">Adulto</option><option value="Criança">Criança</option></select><input type="number" class="input-idade-membro" placeholder="Idade" min="0" max="17" style="display: none; flex: 0.8; padding: 8px; min-width: 60px;"><button onclick="removerLinhaMembro(this)" style="background:none; border:none; color:#d32f2f; font-size:1.2rem; cursor:pointer;">✖</button></div>`); }
function adicionarLinhaMembroEdit() { const c = document.getElementById('container-edit-membros'); if (c) c.insertAdjacentHTML('beforeend', `<div class="linha-edit-membro" style="display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;"><input type="text" class="input-nome-membro" placeholder="Nome" style="flex: 2; min-width: 120px; padding: 8px;"><select class="select-cat-membro" style="flex: 1.5; padding: 8px; min-width: 100px;"><option value="Convidado">Convidado</option><option value="Padrinho">Padrinho</option><option value="Madrinha">Madrinha</option><option value="Noivinho">Noivinho</option><option value="Noivinha">Noivinha</option><option value="Florista">Florista</option><option value="Pajem">Pajem</option></select><select class="select-tipo-membro" onchange="toggleIdadeAdmin(this)" style="flex: 1; padding: 8px; min-width: 90px;"><option value="Adulto">Adulto</option><option value="Criança">Criança</option></select><input type="number" class="input-idade-membro" placeholder="Idade" min="0" max="17" style="display: none; flex: 0.8; padding: 8px; min-width: 60px;"><button onclick="removerLinhaMembro(this)" style="background:none; border:none; color:#d32f2f; font-size:1.2rem; cursor:pointer;">✖</button></div>`); }
function removerLinhaMembro(btn) { btn.parentElement.remove(); }
function salvarNovoConvidado() { const grupo = document.getElementById('novo-grupo-nome').value.trim(); const lado = document.getElementById('novo-grupo-lado').value; if (!grupo) return alert("Digite o nome do grupo!"); const linhas = document.querySelectorAll('.linha-novo-membro'); let membros = []; let temErro = false; linhas.forEach(l => { const n = l.querySelector('.input-nome-membro').value.trim(); const c = l.querySelector('.select-cat-membro').value; const t = l.querySelector('.select-tipo-membro').value; const i = l.querySelector('.input-idade-membro').value; if (!n || (t === 'Criança' && !i)) temErro = true; else membros.push({ nome: n, categoria: c, tipo: t, idade: i }); }); if (temErro || membros.length === 0) return alert("Preencha o nome e idade de todos!"); const btn = document.getElementById('btn-salvar-novo-convidado'); btn.innerText = "Salvando..."; btn.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "adicionarConvidado", grupo: grupo, membros: membros, lado: lado }) }).then(() => fetch(API_URL)).then(r => r.json()).then(dados => { processarDadosPlanilha(dados); alert("Grupo adicionado!"); fecharModal('modal-adicionar-convidado'); document.getElementById('novo-grupo-nome').value = ""; document.getElementById('container-novos-membros').innerHTML = ""; abrirModalListaConvidados(); }).catch(() => alert("Erro.")).finally(() => { btn.innerText = "Salvar na Planilha Oficial"; btn.disabled = false; }); }
function prepararEdicaoGrupo(index) { const grupo = window.estatisticasGlobais.listaOficial[index]; linhaGrupoEditando = grupo.linha; document.getElementById('edit-lista-grupo-nome').value = grupo.identificacao; document.getElementById('edit-lista-grupo-lado').value = grupo.lado || "Outros"; const container = document.getElementById('container-edit-membros'); if (container) container.innerHTML = ""; let membrosLidos = []; if (grupo.categoriasStr && grupo.categoriasStr.startsWith("[")) { try { membrosLidos = JSON.parse(grupo.categoriasStr); } catch (e) { } } else { let nomes = grupo.membros.split(/,\s*|\s+e\s+/i).filter(n => n.trim().length > 0); membrosLidos = nomes.map(n => ({ nome: n, categoria: "Convidado", tipo: "Adulto", idade: "" })); } membrosLidos.forEach(m => { let isCri = m.tipo === "Criança"; let selAd = !isCri ? "selected" : ""; let selCr = isCri ? "selected" : ""; let dispId = isCri ? "block" : "none"; let valIdade = m.idade || ""; const html = `<div class="linha-edit-membro" style="display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;"><input type="text" class="input-nome-membro" value="${m.nome}" style="flex: 2; min-width: 120px; padding: 8px;"><select class="select-cat-membro" style="flex: 1.5; padding: 8px; min-width: 100px;"><option value="Convidado" ${m.categoria === 'Convidado' ? 'selected' : ''}>Convidado</option><option value="Padrinho" ${m.categoria === 'Padrinho' ? 'selected' : ''}>Padrinho</option><option value="Madrinha" ${m.categoria === 'Madrinha' ? 'selected' : ''}>Madrinha</option><option value="Noivinho" ${m.categoria === 'Noivinho' ? 'selected' : ''}>Noivinho</option><option value="Noivinha" ${m.categoria === 'Noivinha' ? 'selected' : ''}>Noivinha</option><option value="Florista" ${m.categoria === 'Florista' ? 'selected' : ''}>Florista</option><option value="Pajem" ${m.categoria === 'Pajem' ? 'selected' : ''}>Pajem</option></select><select class="select-tipo-membro" onchange="toggleIdadeAdmin(this)" style="flex: 1; padding: 8px; min-width: 90px;"><option value="Adulto" ${selAd}>Adulto</option><option value="Criança" ${selCr}>Criança</option></select><input type="number" class="input-idade-membro" placeholder="Idade" min="0" max="17" value="${valIdade}" style="display: ${dispId}; flex: 0.8; padding: 8px; min-width: 60px;"><button onclick="removerLinhaMembro(this)" style="background:none; border:none; color:#d32f2f; font-size:1.2rem; cursor:pointer;">✖</button></div>`; if (container) container.insertAdjacentHTML('beforeend', html); }); fecharModal('modal-lista-convidados'); abrirModal('modal-editar-grupo'); }
function salvarEdicaoGrupo() { const grupo = document.getElementById('edit-lista-grupo-nome').value.trim(); const lado = document.getElementById('edit-lista-grupo-lado').value; if (!grupo) return alert("Digite o nome do grupo!"); const linhas = document.querySelectorAll('.linha-edit-membro'); let membros = []; let temErro = false; linhas.forEach(l => { const n = l.querySelector('.input-nome-membro').value.trim(); const c = l.querySelector('.select-cat-membro').value; const t = l.querySelector('.select-tipo-membro').value; const i = l.querySelector('.input-idade-membro').value; if (!n || (t === 'Criança' && !i)) temErro = true; else membros.push({ nome: n, categoria: c, tipo: t, idade: i }); }); if (temErro || membros.length === 0) return alert("Preencha o nome e idade de todos!"); const btn = document.getElementById('btn-salvar-edicao-grupo'); btn.innerText = "Atualizando..."; btn.disabled = true; document.getElementById('btn-voltar-grupo').disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "editarGrupoConvidado", linha: linhaGrupoEditando, grupo: grupo, membros: membros, lado: lado }) }).then(() => fetch(API_URL)).then(r => r.json()).then(dados => { processarDadosPlanilha(dados); alert("Grupo atualizado!"); }).catch(() => alert("Erro ao salvar.")).finally(() => { btn.innerText = "Salvar Alterações"; btn.disabled = false; document.getElementById('btn-voltar-grupo').disabled = false; }); }


// --- SISTEMA DE RELATÓRIO E CONTAS (DASHBOARD) ---
function mudarAbaDash(abaId, btnSelecionado) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('ativo')); if (btnSelecionado) btnSelecionado.classList.add('ativo'); const aba = document.getElementById(abaId); if (aba) aba.classList.add('ativo'); }

function abrirDetalhesDash(titulo, chaveCategoria) {
    setTextSafe('titulo-detalhe-dash', titulo);
    const container = document.getElementById('conteudo-detalhe-dash');
    if (!container) return;
    container.innerHTML = "";
    const gruposObj = window.dadosDetalhesDash[chaveCategoria] || {}; const chavesGrupos = Object.keys(gruposObj);
    if (chavesGrupos.length === 0) { container.innerHTML = "<p style='color:#888;'>Nenhum registro encontrado nesta categoria.</p>"; }
    else { chavesGrupos.forEach(grupoNome => { let membrosHtml = ""; if (Array.isArray(gruposObj[grupoNome])) { membrosHtml = gruposObj[grupoNome].join(", "); } else { membrosHtml = gruposObj[grupoNome]; } const html = `<div class="bloco-detalhe-grupo"><div class="bloco-detalhe-titulo">${grupoNome}</div><div class="bloco-detalhe-membros">${membrosHtml}</div></div>`; container.innerHTML += html; }); }
    fecharModal('modal-relatorio'); abrirModal('modal-detalhes-dash');
}

// Função à prova de falhas para contar objetos no Dash
function contaMembrosSeguro(catObj) { let total = 0; if (!catObj) return 0; for (let key in catObj) { if (Array.isArray(catObj[key])) total += catObj[key].length; } return total; }

function abrirModalRelatorio() {
    const tabBtn = document.querySelector('.tab-btn'); if (tabBtn) mudarAbaDash('dash-confirmados', tabBtn);
    let totalAdultos = 0; let totalCriancas = 0; let isentosTotal = 0; let contagemIdades = {}; let arrayGruposConfirmados = [];
    window.dadosDetalhesDash = { "Padrinhos & Madrinhas": {}, "Noivinhos(as)": {}, "Pajens": {}, "Floristas": {}, "Crianças": {}, "gruposLista": {}, "pendentes": {}, "Adultos Lista": {}, "Crianças Lista": {}, "Isentos Lista": {} };

    window.listaPresencasGlobais.forEach(p => {
        arrayGruposConfirmados.push(p.grupo);
        if (p.jsonRaw && p.jsonRaw !== "[]") {
            try {
                let objMembros = JSON.parse(p.jsonRaw);
                objMembros.forEach(m => {
                    if (m.status) {
                        if (m.tipo === 'Criança') {
                            let numIdade = parseInt(m.idade);
                            if (!isNaN(numIdade)) {
                                if (numIdade > 9) totalAdultos++; else { totalCriancas++; if (numIdade <= 5) isentosTotal++; }
                                let label = `${numIdade} anos`; contagemIdades[label] = (contagemIdades[label] || 0) + 1;
                            } else { totalCriancas++; }
                            if (!window.dadosDetalhesDash["Crianças"][p.grupo]) window.dadosDetalhesDash["Crianças"][p.grupo] = [];
                            let txIdade = m.idade ? `${m.idade} a.` : "Idade ñ info.";
                            window.dadosDetalhesDash["Crianças"][p.grupo].push(`${m.nome} <span style="color:#1976d2; font-size:0.85em;">(${txIdade})</span>`);
                        } else { totalAdultos++; }
                    }
                });
            } catch (e) { }
        } else { totalAdultos += Number(p.adultos) || 0; totalCriancas += Number(p.criancas) || 0; }
    });

    let listaConvidadosTotal = 0; let listaConvidadosIsentos = 0; let listaConvidadosAdultos = 0; let listaConvidadosCriancas = 0;
    let listaOficial = window.estatisticasGlobais.listaOficial || [];

    listaOficial.forEach(g => {
        let htmlMembrosGeral = "";
        if (g.categoriasStr && g.categoriasStr.startsWith("[")) {
            try {
                let membros = JSON.parse(g.categoriasStr);
                membros.forEach(m => {
                    listaConvidadosTotal++; let cat = m.categoria || "Convidado"; htmlMembrosGeral += `${m.nome} (${cat}), `;
                    let targetCat = null; if (cat === "Padrinho" || cat === "Madrinha") targetCat = "Padrinhos & Madrinhas"; else if (cat === "Noivinho" || cat === "Noivinha") targetCat = "Noivinhos(as)"; else if (cat === "Pajem") targetCat = "Pajens"; else if (cat === "Florista") targetCat = "Floristas";
                    if (targetCat) { if (!window.dadosDetalhesDash[targetCat][g.identificacao]) window.dadosDetalhesDash[targetCat][g.identificacao] = []; window.dadosDetalhesDash[targetCat][g.identificacao].push(m.nome); }
                    if (m.tipo === 'Criança') {
                        let idNum = parseInt(m.idade); let txIdade = m.idade ? `${m.idade} a.` : "Idade ñ info."; let strMembro = `${m.nome} <span style="color:#1976d2; font-size:0.85em;">(${txIdade})</span>`;
                        if (!isNaN(idNum)) {
                            if (idNum > 9) {
                                listaConvidadosAdultos++; if (!window.dadosDetalhesDash["Adultos Lista"][g.identificacao]) window.dadosDetalhesDash["Adultos Lista"][g.identificacao] = []; window.dadosDetalhesDash["Adultos Lista"][g.identificacao].push(`${m.nome} <span style="font-size:0.85em; color:#888;">(${txIdade} - Cont. Adulto)</span>`);
                            } else {
                                listaConvidadosCriancas++; if (!window.dadosDetalhesDash["Crianças Lista"][g.identificacao]) window.dadosDetalhesDash["Crianças Lista"][g.identificacao] = []; window.dadosDetalhesDash["Crianças Lista"][g.identificacao].push(strMembro);
                                if (idNum <= 5) { listaConvidadosIsentos++; if (!window.dadosDetalhesDash["Isentos Lista"][g.identificacao]) window.dadosDetalhesDash["Isentos Lista"][g.identificacao] = []; window.dadosDetalhesDash["Isentos Lista"][g.identificacao].push(strMembro); }
                            }
                        } else {
                            listaConvidadosCriancas++; if (!window.dadosDetalhesDash["Crianças Lista"][g.identificacao]) window.dadosDetalhesDash["Crianças Lista"][g.identificacao] = []; window.dadosDetalhesDash["Crianças Lista"][g.identificacao].push(strMembro);
                        }
                    } else {
                        listaConvidadosAdultos++; if (!window.dadosDetalhesDash["Adultos Lista"][g.identificacao]) window.dadosDetalhesDash["Adultos Lista"][g.identificacao] = []; window.dadosDetalhesDash["Adultos Lista"][g.identificacao].push(m.nome);
                    }
                });
            } catch (e) { }
        } else {
            let nomes = g.membros.split(/,\s*|\s+e\s+/i).filter(n => n.trim().length > 0); listaConvidadosTotal += nomes.length; htmlMembrosGeral = g.membros; listaConvidadosAdultos += nomes.length;
            if (!window.dadosDetalhesDash["Adultos Lista"][g.identificacao]) window.dadosDetalhesDash["Adultos Lista"][g.identificacao] = []; nomes.forEach(n => window.dadosDetalhesDash["Adultos Lista"][g.identificacao].push(n));
        }
        htmlMembrosGeral = htmlMembrosGeral.replace(/, $/, ""); window.dadosDetalhesDash["gruposLista"][g.identificacao] = htmlMembrosGeral;
    });

    let totalConfirmadosGeral = totalAdultos + totalCriancas; let confirmadosPagantes = totalConfirmadosGeral - isentosTotal; let pagantesEstimadoLista = listaConvidadosTotal - listaConvidadosIsentos;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setVal('dash-total-confirmados', totalConfirmadosGeral); setVal('dash-pagantes-confirmados', confirmadosPagantes); setVal('dash-isentos', isentosTotal); setVal('dash-adultos', totalAdultos); setVal('dash-criancas', totalCriancas); setVal('dash-geral-total', listaConvidadosTotal); setVal('dash-total-pagantes-lista', pagantesEstimadoLista); setVal('dash-geral-grupos', listaOficial.length); setVal('dash-geral-adultos', listaConvidadosAdultos); setVal('dash-geral-criancas', listaConvidadosCriancas); setVal('dash-geral-isentos', listaConvidadosIsentos);

    setVal('dash-cat-padrinhos', contaMembrosSeguro(window.dadosDetalhesDash["Padrinhos & Madrinhas"]));
    setVal('dash-cat-noivinhos', contaMembrosSeguro(window.dadosDetalhesDash["Noivinhos(as)"]));
    setVal('dash-cat-pajens', contaMembrosSeguro(window.dadosDetalhesDash["Pajens"]));
    setVal('dash-cat-floristas', contaMembrosSeguro(window.dadosDetalhesDash["Floristas"]));

    let listaPendentes = []; listaOficial.forEach(g => { if (!arrayGruposConfirmados.includes(g.identificacao)) { listaPendentes.push(g); window.dadosDetalhesDash["pendentes"][g.identificacao] = g.membros; } });
    setTextSafe('dash-grupos-pendentes', listaPendentes.length);

    let pendentesHtml = ""; if (listaPendentes.length === 0) { pendentesHtml = "<p style='color:#388e3c;'>Todos confirmaram!</p>"; } else { listaPendentes.forEach(p => { pendentesHtml += `<div style="padding: 10px; border-bottom: 1px solid #f0d8d8;"><strong style="color:#555;">${p.identificacao}</strong><br><span style="font-size:0.85rem; color:#888;">${p.membros}</span></div>`; }); }
    setHtmlSafe('lista-grupos-pendentes', pendentesHtml);
    const arP = document.getElementById('area-pendentes'); if (arP) arP.style.display = "none";

    let ulIdadesHtml = ""; if (Object.keys(contagemIdades).length === 0) { ulIdadesHtml = "<li>Nenhuma criança confirmada.</li>"; } else { for (const [idade, qtd] of Object.entries(contagemIdades)) { ulIdadesHtml += `<li>👶 ${idade}: <strong>${qtd}</strong></li>`; } }
    setHtmlSafe('lista-idades-criancas', ulIdadesHtml);

    abrirModal('modal-relatorio');
}

function togglePendentes() { let area = document.getElementById('area-pendentes'); if (area) area.style.display = area.style.display === "none" ? "block" : "none"; }
function abrirModalPresenca() { const container = document.getElementById('conteudo-lista-presenca'); if (!container) return; container.innerHTML = ""; if (!window.listaPresencasGlobais || window.listaPresencasGlobais.length === 0) { container.innerHTML = "<p style='text-align:center; color:#888;'>Nenhuma presença confirmada ainda.</p>"; } else { window.listaPresencasGlobais.forEach((p, indexOriginalArray) => { const naoViraoHtml = p.naoConfirmados ? `<p style="color:#d32f2f; font-size:0.9rem; margin-bottom:5px;"><strong>❌ Não virão:</strong> ${p.naoConfirmados}</p>` : ''; let btnEditar = ""; if (p.jsonRaw && p.jsonRaw !== "[]") { btnEditar = `<button onclick="prepararEdicaoRsvp(${indexOriginalArray})" style="background: #1976d2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition:0.3s; height: fit-content;">✏️ Editar</button>`; } const html = `<div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 6px; margin-bottom: 15px; background: #f9f9f9; display: flex; justify-content: space-between; gap: 15px; align-items: flex-start; flex-wrap: wrap;"><div style="flex: 1; min-width: 200px;"><h4 style="color: #8c7b65; margin-bottom: 8px; font-family: 'Playfair Display', serif; font-size: 1.2rem;">${p.grupo || "Convite Avulso"}</h4><p style="font-size: 0.95rem; margin-bottom: 5px; color:#2e7d32;"><strong>✅ Confirmados:</strong> ${p.confirmados}</p>${naoViraoHtml}<div style="margin-top: 10px; font-size: 0.85rem; color: #555; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #ddd;">📞 ${p.telefone}</div></div><div style="display: flex; gap: 5px;">${btnEditar}<button onclick="cancelarConfirmacao(${p.linha}, this)" style="background: #d32f2f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition:0.3s; height: fit-content;">🗑️ Apagar</button></div></div>`; container.insertAdjacentHTML('beforeend', html); }); } abrirModal('modal-lista-presenca'); }
function cancelarConfirmacao(linha, btn) { if (confirm("Apagar essa confirmação da planilha?")) { const card = btn.parentElement.parentElement; btn.innerText = "..."; btn.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "cancelarRSVP", linha: linha }) }).then(() => { card.remove(); fetch(API_URL).then(r => r.json()).then(dados => processarDadosPlanilha(dados)); }).catch(() => { alert("Erro."); btn.innerText = "🗑️ Apagar"; btn.disabled = false; }); } }
function prepararEdicaoRsvp(indexArrayGlobal) { const rsvp = window.listaPresencasGlobais[indexArrayGlobal]; linhaRsvpEditando = rsvp.linha; document.getElementById('edit-rsvp-grupo').innerText = "Grupo: " + rsvp.grupo; const containerMembros = document.getElementById('edit-rsvp-membros'); if (!containerMembros) return; containerMembros.innerHTML = ""; try { let membrosArray = JSON.parse(rsvp.jsonRaw); membrosArray.forEach((m, idx) => { const checkedStr = m.status ? "checked" : ""; const inativoCls = m.status ? "" : "inativo"; const isCrianca = m.tipo === "Criança"; const selectAdulto = isCrianca ? "" : "selected"; const selectCrianca = isCrianca ? "selected" : ""; const displayIdade = isCrianca ? "block" : "none"; const html = `<div class="membro-rsvp-item ${inativoCls}" id="edit-bloco-membro-${idx}"><label style="display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; color: #333;"><input type="checkbox" class="edit-cb-membro" value="${m.nome}" ${checkedStr} onchange="toggleMembroEdit(this, ${idx})" style="width: 20px; height: 20px; accent-color: #1976d2;"> ${m.nome}</label><div id="edit-opcoes-membro-${idx}" style="margin-top: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; opacity: ${m.status ? '1' : '0.3'}; pointer-events: ${m.status ? 'auto' : 'none'};"><select class="edit-tipo-membro" onchange="toggleIdadeEdit(this, ${idx})" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;"><option value="Adulto" ${selectAdulto}>É Adulto</option><option value="Criança" ${selectCrianca}>É Criança (até 9 anos)</option></select><input type="number" id="edit-idade-crianca-${idx}" class="edit-idade-membro" placeholder="Idade" min="0" max="17" value="${m.idade}" style="display: ${displayIdade}; padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 80px;"></div></div>`; containerMembros.insertAdjacentHTML('beforeend', html); }); fecharModal('modal-lista-presenca'); abrirModal('modal-editar-presenca'); } catch (e) { alert("Não editável."); } }
function toggleMembroEdit(cb, idx) { const b = document.getElementById(`edit-bloco-membro-${idx}`); const o = document.getElementById(`edit-opcoes-membro-${idx}`); if (cb.checked) { b.classList.remove('inativo'); o.style.opacity = "1"; o.style.pointerEvents = "auto"; } else { b.classList.add('inativo'); o.style.opacity = "0.3"; o.style.pointerEvents = "none"; } }
function toggleIdadeEdit(sel, idx) { const c = document.getElementById(`edit-idade-crianca-${idx}`); if (sel.value === "Criança") { c.style.display = "block"; } else { c.style.display = "none"; c.value = ""; } }
function salvarEdicaoRSVP() { let totalA = 0; let totalC = 0; let confArray = []; let naoConfArray = []; let temErro = false; let novaMemoriaJson = []; const blocos = document.querySelectorAll('#edit-rsvp-membros .membro-rsvp-item'); blocos.forEach(b => { const cb = b.querySelector('.edit-cb-membro'); const nome = cb.value; if (cb.checked) { const tipo = b.querySelector('.edit-tipo-membro').value; if (tipo === 'Adulto') { totalA++; confArray.push(`${nome} (Adulto)`); novaMemoriaJson.push({ nome: nome, status: true, tipo: "Adulto", idade: "" }); } else { const idade = b.querySelector('.edit-idade-membro').value; if (idade === "") temErro = true; else { let idNum = parseInt(idade); if (idNum > 9) { totalA++; confArray.push(`${nome} (Criança: ${idade} anos - Cont. Adulto)`); } else { totalC++; confArray.push(`${nome} (Criança: ${idade} anos)`); } novaMemoriaJson.push({ nome: nome, status: true, tipo: "Criança", idade: idade }); } } } else { naoConfArray.push(nome); novaMemoriaJson.push({ nome: nome, status: false, tipo: "", idade: "" }); } }); if (temErro) return alert("Preencha a idade das crianças!"); if (totalA === 0 && totalC === 0) return alert("Se ninguém vai, use o botão de Apagar no painel anterior."); const btn = document.getElementById('btn-salvar-edicao-rsvp'); btn.innerText = "Atualizando..."; btn.disabled = true; document.getElementById('btn-voltar-rsvp').disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "editarRSVP", linha: linhaRsvpEditando, confirmados: confArray.join(" | "), naoConfirmados: naoConfArray.join(" | "), adultos: totalA, criancas: totalC, jsonRaw: JSON.stringify(novaMemoriaJson) }) }).then(() => fetch(API_URL)).then(r => r.json()).then(dados => { processarDadosPlanilha(dados); alert("Salvo!"); }).finally(() => { btn.innerText = "Salvar Alterações"; btn.disabled = false; document.getElementById('btn-voltar-rsvp').disabled = false; }); }

function buscarConvidado() { const nomeDigitado = document.getElementById('rsvp-busca').value; const btn = document.getElementById('btn-buscar-convite'); const msg = document.getElementById('msg-busca'); if (!nomeDigitado || nomeDigitado.length < 3) return alert("Digite pelo menos 3 letras."); btn.innerText = "⏳"; btn.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "verificarNome", nome: nomeDigitado }) }).then(res => res.json()).then(dados => { if (dados.encontrado) { grupoRSVP = dados.grupo; document.getElementById('bloco-busca').style.display = "none"; document.getElementById('caixa-grupo').style.display = "block"; document.getElementById('bloco-formulario').style.display = "block"; setTextSafe('rsvp-identificacao', grupoRSVP.identificacao ? "Grupo: " + grupoRSVP.identificacao : "Convite Localizado"); let containerCheckboxes = document.getElementById('lista-checkbox-membros'); if (containerCheckboxes) containerCheckboxes.innerHTML = ""; let membrosLidos = []; if (grupoRSVP.categoriasStr && grupoRSVP.categoriasStr.startsWith("[")) { try { membrosLidos = JSON.parse(grupoRSVP.categoriasStr); } catch (e) { } } if (membrosLidos.length > 0) { membrosLidos.forEach((m, index) => { let tagHtml = m.categoria !== "Convidado" ? `<span class="tag-categoria">${m.categoria}</span>` : ""; let isCri = m.tipo === "Criança"; let selAd = !isCri ? "selected" : ""; let selCr = isCri ? "selected" : ""; let dispId = isCri ? "block" : "none"; let valIdade = m.idade || ""; const html = `<div class="membro-rsvp-item" id="bloco-membro-${index}"><label style="display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; color: #333;"><input type="checkbox" class="cb-membro" value="${m.nome.trim()}" checked onchange="toggleMembro(this, ${index})" style="width: 20px; height: 20px; accent-color: #8c7b65;"> ${m.nome.trim()} ${tagHtml}</label><div id="opcoes-membro-${index}" style="margin-top: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><select class="tipo-membro" onchange="toggleIdade(this, ${index})" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #fff;"><option value="Adulto" ${selAd}>É Adulto</option><option value="Criança" ${selCr}>É Criança (até 9 anos)</option></select><input type="number" id="idade-crianca-${index}" class="idade-membro" placeholder="Idade" min="0" max="17" value="${valIdade}" style="display: ${dispId}; padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 80px;"></div></div>`; if (containerCheckboxes) containerCheckboxes.insertAdjacentHTML('beforeend', html); }); } else { let arrayNomes = grupoRSVP.nomes.split(/,\s*|\s+e\s+/i).filter(n => n.trim().length > 0); arrayNomes.forEach((nomeMembro, index) => { const html = `<div class="membro-rsvp-item" id="bloco-membro-${index}"><label style="display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; color: #333;"><input type="checkbox" class="cb-membro" value="${nomeMembro.trim()}" checked onchange="toggleMembro(this, ${index})" style="width: 20px; height: 20px; accent-color: #8c7b65;"> ${nomeMembro.trim()}</label><div id="opcoes-membro-${index}" style="margin-top: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><select class="tipo-membro" onchange="toggleIdade(this, ${index})" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #fff;"><option value="Adulto">É Adulto</option><option value="Criança">É Criança (até 9 anos)</option></select><input type="number" id="idade-crianca-${index}" class="idade-membro" placeholder="Idade" min="0" max="17" style="display: none; padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 80px;"></div></div>`; if (containerCheckboxes) containerCheckboxes.insertAdjacentHTML('beforeend', html); }); } } else { msg.innerText = "❌ Nome não localizado."; msg.style.color = "#d32f2f"; } }).catch(() => msg.innerText = "Erro na busca.").finally(() => { btn.innerText = "Buscar"; btn.disabled = false; }); }
function toggleMembro(cb, idx) { const b = document.getElementById(`bloco-membro-${idx}`); const o = document.getElementById(`opcoes-membro-${idx}`); if (cb.checked) { b.classList.remove('inativo'); o.style.opacity = "1"; o.style.pointerEvents = "auto"; } else { b.classList.add('inativo'); o.style.opacity = "0.3"; o.style.pointerEvents = "none"; } }
function toggleIdade(sel, idx) { const c = document.getElementById(`idade-crianca-${idx}`); if (sel.value === "Criança") { c.style.display = "block"; } else { c.style.display = "none"; c.value = ""; } }
function enviarRSVP() { const tel = document.getElementById('rsvp-telefone').value; if (!tel) return alert("Por favor, informe o telefone de contato principal do grupo!"); let totalA = 0; let totalC = 0; let confArray = []; let naoConfArray = []; let temErro = false; let memoriaJson = []; const blocos = document.querySelectorAll('#caixa-grupo .membro-rsvp-item'); blocos.forEach(b => { const cb = b.querySelector('.cb-membro'); const nome = cb.value; if (cb.checked) { const tipo = b.querySelector('.tipo-membro').value; if (tipo === 'Adulto') { totalA++; confArray.push(`${nome} (Adulto)`); memoriaJson.push({ nome: nome, status: true, tipo: "Adulto", idade: "" }); } else { const idade = b.querySelector('.idade-membro').value; if (idade === "") temErro = true; else { let idNum = parseInt(idade); if (idNum > 9) { totalA++; confArray.push(`${nome} (Criança: ${idade} anos - Cont. Adulto)`); } else { totalC++; confArray.push(`${nome} (Criança: ${idade} anos)`); } memoriaJson.push({ nome: nome, status: true, tipo: "Criança", idade: idade }); } } } else { naoConfArray.push(nome); memoriaJson.push({ nome: nome, status: false, tipo: "", idade: "" }); } }); if (temErro) return alert("Preencha a idade das crianças."); if (totalA === 0 && totalC === 0) return alert("Selecione pelo menos uma pessoa."); const btn = document.getElementById('btn-enviar-rsvp'); btn.innerText = "Enviando..."; btn.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "rsvp", grupo: grupoRSVP.identificacao, confirmados: confArray.join(" | "), naoConfirmados: naoConfArray.join(" | "), telefone: tel, adultos: totalA, criancas: totalC, jsonRaw: JSON.stringify(memoriaJson) }) }).then(() => { alert("Presença confirmada!"); location.reload(); }).catch(() => alert("Erro.")).finally(() => { btn.innerText = "Confirmar Nossa Presença"; btn.disabled = false; }); }

function mudarStatusPresente(id, e) { e.target.innerText = "⏳"; e.target.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "mudarStatus", id: id, novoStatus: "" }) }).then(() => carregarListaDaPlanilha()); }
function abrirModalConfigPix() { document.getElementById('config-chave-pix').value = dadosPixNuvem.chave; document.getElementById('config-qr-pix').value = dadosPixNuvem.qr; abrirModal('modal-config-pix'); }
function salvarConfigPix() { const k = document.getElementById('config-chave-pix').value; const q = document.getElementById('config-qr-pix').value; if (!k || !q) return alert("Preencha!"); const b = document.getElementById('btn-salvar-pix'); b.innerText = "⏳"; b.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "configPix", chave: k, qr: q }) }).then(() => { dadosPixNuvem.chave = k; dadosPixNuvem.qr = q; alert("PIX atualizado!"); fecharModal('modal-config-pix'); }).finally(() => { b.innerText = "Salvar na Nuvem"; b.disabled = false; }); }
function salvarNovoPresente() { const n = document.getElementById('novo-nome').value; let v = document.getElementById('novo-valor').value; let img = document.getElementById('nova-imagem').value; if (!n || !v) return; if (!img) img = "https://via.placeholder.com/300"; const b = document.getElementById('btn-salvar-novo'); b.innerText = "⏳"; b.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "adicionar", id: "ID-" + Date.now(), nome: n, valor: v, imagem: img }) }).then(() => { fecharModal('modal-adicionar'); carregarListaDaPlanilha(); document.getElementById('novo-nome').value = ""; document.getElementById('novo-valor').value = ""; document.getElementById('nova-imagem').value = ""; }).finally(() => { b.innerText = "Salvar"; b.disabled = false; }); }
function abrirModalEditar(id, n, v, img) { idEditando = id; document.getElementById('edit-nome').value = n; document.getElementById('edit-valor').value = String(v).replace('R$', '').trim(); document.getElementById('edit-imagem').value = img; abrirModal('modal-editar'); }
function salvarEdicao() { const n = document.getElementById('edit-nome').value; let v = document.getElementById('edit-valor').value; let img = document.getElementById('edit-imagem').value; if (!img) img = "https://via.placeholder.com/300"; const b = document.getElementById('btn-salvar-edicao'); b.innerText = "⏳"; b.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "editar", id: idEditando, nome: n, valor: v, imagem: img }) }).then(() => { fecharModal('modal-editar'); carregarListaDaPlanilha(); }).finally(() => { b.innerText = "Atualizar"; b.disabled = false; }); }
function excluirPresente(id, e) { if (confirm("Ocultar item?")) { e.target.innerText = "⏳"; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "excluir", id: id }) }).then(() => carregarListaDaPlanilha()); } }
function abrirModalPix(id, n, v) { idComprando = id; nomeComprando = n; setTextSafe('modal-titulo', n); setTextSafe('modal-valor', "R$ " + String(v).replace('R$', '').trim()); document.getElementById('img-qr-pix-modal').src = dadosPixNuvem.qr; document.getElementById('codigo-pix').value = dadosPixNuvem.chave; document.getElementById('input-nome-pix').value = ""; document.getElementById('input-mensagem-pix').value = ""; abrirModal('modal-pix'); }
function confirmarPagamentoPix() { const n = document.getElementById('input-nome-pix').value; const m = document.getElementById('input-mensagem-pix').value; if (!n) return alert("Seu nome!"); const b = document.getElementById('btn-enviar-pix'); b.innerText = "⏳"; b.disabled = true; fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "comprar", id: idComprando, nomePresente: nomeComprando, nomeConvidado: n, mensagemTexto: m }) }).then(() => { alert("Mensagem enviada!"); fecharModal('modal-pix'); carregarListaDaPlanilha(); }).finally(() => { b.innerText = "Confirmar"; b.disabled = false; }); }
function fazerLogin() { const u = document.getElementById('login-user').value; const p = document.getElementById('login-pass').value; const c = JSON.parse(localStorage.getItem('credenciaisAdmin')); if (u === c.user && p === c.pass) { sessionStorage.setItem('logadoComoAdmin', 'sim'); document.getElementById('corpo-site').classList.add('modo-admin-ativo'); fecharModal('modal-login'); carregarListaDaPlanilha(); } else alert("Senha incorreta!"); }
function sairAdmin() { sessionStorage.removeItem('logadoComoAdmin'); document.getElementById('corpo-site').classList.remove('modo-admin-ativo'); carregarListaDaPlanilha(); }
function salvarNovasCredenciais() { const u = document.getElementById('novo-admin-user').value; const p = document.getElementById('novo-admin-pass').value; if (u && p) { localStorage.setItem('credenciaisAdmin', JSON.stringify({ user: u, pass: p })); alert("Atualizado!"); fecharModal('modal-config-admin'); } else alert("Preencha tudo!"); }
function abrirModal(id) { document.getElementById(id).style.display = "block"; }
function fecharModal(id) { document.getElementById(id).style.display = "none"; }

window.onclick = function (e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = "none";
        if (e.target.id === "modal-detalhes-dash") abrirModal('modal-relatorio');
        if (e.target.id === "modal-editar-grupo") abrirModal('modal-lista-convidados');
        if (e.target.id === "modal-editar-presenca") abrirModal('modal-lista-presenca');
        if (e.target.id === "modal-selecionar-convidados-mesa") abrirModal('modal-mesas');
    }
}
function copiarPix() { const c = document.getElementById("codigo-pix"); c.select(); c.setSelectionRange(0, 99999); navigator.clipboard.writeText(c.value); alert("Copiado!"); }

function filtrarLado(lado, btn) {
    filtroLadoAtual = lado.toUpperCase();
    document.querySelectorAll('.btn-filtro-lado').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    renderizarPaineisMesas();
}

function preencherMesasAutomatico() {
    if (!confirm("Deseja criar mesas e distribuir TODOS os convidados separando por Lado?")) return;

    // 1. Limpar mesas atuais para uma distribuição do zero (opcional, mas recomendado para evitar erro)
    layoutMesas = [];

    // 2. Separar convidados por Lado e depois por Grupo
    const separarPorLadoEGrupo = (lista) => {
        return lista.reduce((acc, conv) => {
            const lado = (conv.lado || "OUTROS").toUpperCase();
            if (!acc[lado]) acc[lado] = {};
            if (!acc[lado][conv.grupo]) acc[lado][conv.grupo] = [];
            acc[lado][conv.grupo].push(conv);
            return acc;
        }, {});
    };

    const mapaLados = separarPorLadoEGrupo(todosConvidadosArray);
    const assentosPorMesa = parseInt(document.getElementById('qtd-assentos-nova-mesa').value) || 8;

    // 3. Função para processar cada lado separadamente
    const distribuirLado = (gruposDoLado) => {
        let mesaAtualId = adicionarMesa(assentosPorMesa);
        let mesaAtual = layoutMesas.find(m => m.id === mesaAtualId);

        for (const nomeGrupo in gruposDoLado) {
            const membrosGrupo = gruposDoLado[nomeGrupo];
            let vagas = mesaAtual.assentos - mesaAtual.convidados.length;

            // Se o grupo inteiro não cabe na mesa atual, cria uma nova mesa ANTES de começar a colocar
            // Isso evita misturar muito, mas se o grupo for maior que a mesa, ele transborda
            if (membrosGrupo.length > vagas && mesaAtual.convidados.length > 0) {
                mesaAtualId = adicionarMesa(assentosPorMesa);
                mesaAtual = layoutMesas.find(m => m.id === mesaAtualId);
                vagas = mesaAtual.assentos;
            }

            membrosGrupo.forEach(pessoa => {
                if (mesaAtual.convidados.length >= mesaAtual.assentos) {
                    mesaAtualId = adicionarMesa(assentosPorMesa);
                    mesaAtual = layoutMesas.find(m => m.id === mesaAtualId);
                }
                mesaAtual.convidados.push(pessoa);
            });
        }
    };

    // 4. Executa a distribuição por Lado (Garante que nunca misture Lados na mesma mesa)
    if (mapaLados["NOIVO"]) distribuirLado(mapaLados["NOIVO"]);
    if (mapaLados["NOIVA"]) distribuirLado(mapaLados["NOIVA"]);
    if (mapaLados["OUTROS"]) distribuirLado(mapaLados["OUTROS"]);
    if (mapaLados["TODOS"]) distribuirLado(mapaLados["TODOS"]);

    renderizarPaineisMesas();
    alert("Mesas criadas e convidados distribuídos por lado com sucesso!");
}