const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

async function enviarEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada.');

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Fanáticos FC <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Erro ao enviar e-mail.');
  }
  return res.json();
}

function buildCodigoEmailHtml(codigo, ttlMinutes) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0d0d0d;color:#f2f2f2;border-radius:12px">
      <h1 style="color:#ff6b00;font-size:20px;margin:0 0 16px">Fanáticos FC</h1>
      <p style="font-size:15px;margin:0 0 20px">Use o código abaixo para confirmar seu e-mail:</p>
      <p style="font-size:34px;font-weight:700;letter-spacing:8px;color:#fff;margin:0 0 20px">${codigo}</p>
      <p style="font-size:13px;color:#999;margin:0">Esse código expira em ${ttlMinutes} minutos. Se você não solicitou, ignore este e-mail.</p>
    </div>
  `;
}

async function enviarCodigoVerificacao(destinatario, codigo, ttlMinutes = 15) {
  return enviarEmail({
    to: destinatario,
    subject: 'Seu código de verificação — Fanáticos FC',
    html: buildCodigoEmailHtml(codigo, ttlMinutes),
  });
}

async function enviarRecuperacaoSenha(destinatario, resetUrl, ttlMinutes = 30) {
  return enviarEmail({
    to: destinatario,
    subject: 'Recuperação de senha — Fanáticos FC',
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h1>Recuperação de senha</h1>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p><a href="${escapeHtml(resetUrl)}" style="background:#ff6b00;color:white;padding:12px 18px;text-decoration:none;border-radius:6px">Criar nova senha</a></p>
      <p>O link expira em ${ttlMinutes} minutos e só pode ser usado uma vez. Se você não solicitou, ignore este e-mail.</p>
    </div>`,
  });
}

async function enviarAtualizacaoPedido(destinatario, { nome, pedidoId, tipo, status, rastreioUrl }) {
  const subjects = {
    confirmado: `Pedido #${pedidoId} confirmado`,
    enviado: `Pedido #${pedidoId} enviado`,
    cancelado: `Pedido #${pedidoId} cancelado`,
    reembolsado: `Reembolso do pedido #${pedidoId}`,
  };
  return enviarEmail({
    to: destinatario,
    subject: subjects[tipo] || `Atualização do pedido #${pedidoId}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h1>Olá, ${escapeHtml(nome || 'cliente')}!</h1>
      <p>Seu pedido <strong>#${escapeHtml(pedidoId)}</strong> foi atualizado para <strong>${escapeHtml(status)}</strong>.</p>
      ${rastreioUrl ? `<p><a href="${escapeHtml(rastreioUrl)}">Acompanhar entrega</a></p>` : ''}
      <p>Você também pode acompanhar tudo pela área Minha Conta.</p>
    </div>`,
  });
}

async function enviarCarrinhoAbandonado(destinatario, { nome, cartUrl }) {
  return enviarEmail({
    to: destinatario,
    subject: 'Seus produtos ainda estão no carrinho',
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h1>Olá, ${escapeHtml(nome || 'cliente')}!</h1>
      <p>Seu carrinho foi salvo. Os produtos podem esgotar, então finalize quando estiver pronto.</p>
      <p><a href="${escapeHtml(cartUrl)}">Continuar compra</a></p>
    </div>`,
  });
}

async function enviarAlertaReposicao(destinatario, { produtoNome, tamanho, cor, productUrl }) {
  const variant = [tamanho, cor].filter(Boolean).join(' / ');
  return enviarEmail({
    to: destinatario,
    subject: `${produtoNome} voltou ao estoque`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h1>Produto disponível novamente</h1>
      <p><strong>${escapeHtml(produtoNome)}</strong>${variant ? ` (${escapeHtml(variant)})` : ''} voltou ao estoque.</p>
      <p>A disponibilidade pode mudar rapidamente.</p>
      <p><a href="${escapeHtml(productUrl)}">Ver produto</a></p>
    </div>`,
  });
}

module.exports = {
  enviarCarrinhoAbandonado,
  enviarAlertaReposicao,
  enviarCodigoVerificacao,
  enviarEmail,
  enviarRecuperacaoSenha,
  enviarAtualizacaoPedido,
};
