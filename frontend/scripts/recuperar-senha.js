document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('passwordResetForm');
  const message = document.getElementById('resetMessage');
  const button = document.getElementById('resetSubmit');
  const token = new URLSearchParams(window.location.search).get('token');

  if (token) {
    document.getElementById('resetTitle').textContent = 'Criar nova senha';
    document.getElementById('resetHelp').textContent = 'Escolha uma senha forte para proteger sua conta.';
    document.getElementById('resetEmailGroup').style.display = 'none';
    document.getElementById('newPasswordFields').style.display = 'block';
    document.getElementById('resetPassword').required = true;
    document.getElementById('resetPasswordConfirm').required = true;
    button.textContent = 'Redefinir senha';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    message.style.display = 'none';
    try {
      let result;
      if (token) {
        const password = document.getElementById('resetPassword').value;
        const confirmation = document.getElementById('resetPasswordConfirm').value;
        if (password !== confirmation) throw new Error('As senhas não coincidem.');
        const weakPassword = erroSenhaFraca(password);
        if (weakPassword) throw new Error(weakPassword);
        result = await api.post('/auth/redefinir-senha', { token, novaSenha: password });
        button.style.display = 'none';
      } else {
        const email = document.getElementById('resetEmail').value.trim();
        result = await api.post('/auth/solicitar-recuperacao', { email });
      }
      message.textContent = result.message;
      message.style.display = 'block';
      message.style.color = 'var(--success)';
    } catch (error) {
      message.textContent = error.message;
      message.style.display = 'block';
      message.style.color = 'var(--danger)';
    } finally {
      button.disabled = false;
    }
  });
});
