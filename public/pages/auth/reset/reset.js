function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    const token = getTokenFromUrl();
    if (!token) {
        document.getElementById('reset-form-container').innerHTML = '<h2>Error: Missing reset token.</h2>';
        return;
    }

    const resetForm = document.getElementById('reset-form');
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        try {
            const response = await fetch('/api/resetPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Password successfully reset! You can now log in.');
                window.location.href = '/pages/auth/login/login.html';
            } else {
                alert(`Reset failed: ${data.message}`);
            }
        } catch (error) {
            console.error('API Error:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });
});
