const paymentSessionId = new URLSearchParams(window.location.search).get('session_id');

function setPaymentStatus(title, message, icon, orderId = null) {
  const titleEl = document.getElementById('pagamentoStatusTitle');
  const textEl = document.getElementById('pagamentoStatusText');
  const iconEl = document.getElementById('pagamentoStatusIcon');
  const orderEl = document.getElementById('pagamentoOrder');
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  if (orderEl) orderEl.textContent = orderId ? `Pedido #${orderId}` : '';
}

async function confirmPaymentStatus(attempt = 0) {
  if (!paymentSessionId) {
    setPaymentStatus('Sessão não encontrada', 'Não foi possível identificar a sessão de pagamento. Acesse sua conta para consultar seus pedidos.', '⚠️');
    return;
  }

  try {
    const status = await api.get(`/pagamentos/stripe/session/${encodeURIComponent(paymentSessionId)}`);
    if (status.paymentStatus === 'paid') {
      localStorage.removeItem('fc_cart');
      setPaymentStatus('Pagamento confirmado!', 'Recebemos a confirmação do Stripe e registramos seu pedido. Você pode acompanhar tudo na sua conta.', '✅', status.orderId);
      return;
    }
    if (status.status === 'payment_failed') {
      setPaymentStatus('Pagamento não concluído', 'O Stripe informou que o pagamento não foi aprovado. Seu carrinho foi mantido para uma nova tentativa.', '⚠️');
      return;
    }
    if (attempt < 10) {
      setPaymentStatus('Confirmando seu pagamento', 'O pagamento foi enviado ao Stripe e ainda está sendo confirmado. Esta página será atualizada automaticamente.', '⏳');
      setTimeout(() => confirmPaymentStatus(attempt + 1), 2000);
      return;
    }
    setPaymentStatus('Confirmação pendente', 'O pagamento ainda está sendo processado. Consulte “Meus pedidos” novamente em instantes.', '⏳');
  } catch (error) {
    setPaymentStatus('Não foi possível consultar agora', error.message || 'Tente novamente em instantes ou consulte sua conta.', '⚠️');
  }
}

document.addEventListener('DOMContentLoaded', confirmPaymentStatus);
