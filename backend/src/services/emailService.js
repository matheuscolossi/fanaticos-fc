const RESEND_API_URL = 'https://api.resend.com/emails';

function buildCodigoEmailHtml(codigo) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0d0d0d;color:#f2f2f2;border-radius:12px">
      <h1 style="color:#ff6b00;font-size:20px;margin:0 0 16px">Fanáticos FC</h1>
      <p style="font-size:15px;margin:0 0 20px">Use o código abaixo para confirmar seu e-mail:</p>
      <p style="font-size:34px;font-weight:700;letter-spacing:8px;color:#fff;margin:0 0 20px">${codigo}</p>
      <p style="font-size:13px;color:#999;margin:0">Esse código expira em 15 minutos. Se você não solicitou, ignore este e-mail.</p>
    </div>
  `;
}

async function enviarCodigoVerificacao(destinatario, codigo) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada.');

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Fanáticos FC <onboarding@resend.dev>',
      to: destinatario,
      subject: 'Seu código de verificação — Fanáticos FC',
      html: buildCodigoEmailHtml(codigo),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Erro ao enviar e-mail de verificação.');
  }

  return res.json();
}

module.exports = { enviarCodigoVerificacao };
