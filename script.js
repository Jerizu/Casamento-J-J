// Variável para guardar qual presente está sendo pago no momento
let idPresenteAtual = "";

function abrirModal(nome, valor, imagemUrl, codigoPix, idElemento) {
    document.getElementById('modal-titulo').innerText = nome;
    document.getElementById('modal-valor').innerText = valor;
    document.getElementById('codigo-pix').value = codigoPix;
    
    // Salva o ID do elemento clicado para podermos removê-lo depois
    idPresenteAtual = idElemento;
    
    const imgQr = document.getElementById('modal-img-qr');
    const placeholder = document.getElementById('placeholder-qr');
    
    if(imagemUrl && !imagemUrl.includes('qrcode-')) {
        imgQr.src = imagemUrl;
        imgQr.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        imgQr.style.display = 'none';
        placeholder.style.display = 'flex';
    }

    document.getElementById('mensagem-copiado').innerText = ""; 
    document.getElementById('modal-pix').style.display = "block"; 
}

function fecharModal() {
    document.getElementById('modal-pix').style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-pix');
    if (event.target == modal) {
        fecharModal();
    }
}

function copiarPix() {
    const campoTexto = document.getElementById("codigo-pix");
    campoTexto.select();
    campoTexto.setSelectionRange(0, 99999); 
    
    navigator.clipboard.writeText(campoTexto.value).then(() => {
        document.getElementById("mensagem-copiado").innerText = "Código copiado!";
    }).catch(err => {
        document.getElementById("mensagem-copiado").innerText = "Erro ao copiar.";
    });
}

// Nova função: Faz o item sumir da tela após a confirmação
function confirmarPagamento() {
    if(idPresenteAtual !== "") {
        const itemParaRemover = document.getElementById(idPresenteAtual);
        
        // Adiciona a classe que faz o efeito de sumir
        itemParaRemover.classList.add('sumindo');
        
        // Aguarda meio segundo para a animação acontecer e depois apaga do HTML
        setTimeout(() => {
            itemParaRemover.remove();
        }, 500);
        
        // Fecha a janela do PIX
        fecharModal();
        
        // Limpa a variável
        idPresenteAtual = "";
    }
}