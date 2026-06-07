document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('paymentModal');
    const closeBtn = document.querySelector('.close');
    const paymentForm = document.getElementById('paymentForm');
    const planButtons = document.querySelectorAll('.buy-plan');
    const selectedPlanInput = document.getElementById('selectedPlanId');

    // Modal Control
    planButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const planId = btn.getAttribute('data-plan-id');
            selectedPlanInput.value = planId;
            modal.style.display = 'block';
        });
    });

    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = 'none';
    };

    // Payment Initiation
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const planId = selectedPlanInput.value;

            try {
                const response = await fetch('/api/payment/initiate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, planId })
                });

                const data = await response.json();
                if (data.authorization_url) {
                    // Open Paystack in a new window or redirect
                    window.location.href = data.authorization_url;
                } else {
                    alert('Error initiating payment: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error(err);
                alert('Connection error. Please try again.');
            }
        });
    }
});
