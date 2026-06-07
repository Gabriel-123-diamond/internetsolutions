document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('paymentModal');
    const closeBtn = document.querySelector('.close');
    const paymentForm = document.getElementById('paymentForm');
    const planButtons = document.querySelectorAll('.buy-plan');
    const selectedPlanInput = document.getElementById('selectedPlanId');
    const publicKey = document.getElementById('paystack-public-key').value;

    console.log("Portal JS Loaded. Public Key:", publicKey);

    // Modal Control
    planButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const planId = btn.getAttribute('data-plan-id');
            console.log("Plan selected:", planId);
            selectedPlanInput.value = planId;
            modal.style.display = 'block';
        });
    });

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    // Paystack Inline Integration
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const planId = selectedPlanInput.value;

            const submitBtn = paymentForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            try {
                console.log("Initiating payment for plan:", planId);
                const response = await fetch('/api/payment/initiate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, planId })
                });

                const data = await response.json();
                
                if (data.reference) {
                    // Use Paystack Inline Popup
                    const handler = PaystackPop.setup({
                        key: publicKey,
                        email: email,
                        amount: data.amount, // Amount in kobo
                        ref: data.reference,
                        metadata: data.metadata,
                        callback: function(response) {
                            console.log("Payment successful. Reference:", response.reference);
                            // Redirect to success page for verification and voucher display
                            window.location.href = `/api/payment/success?reference=${response.reference}`;
                        },
                        onClose: function() {
                            console.log("Payment window closed.");
                            submitBtn.disabled = false;
                            submitBtn.innerText = 'Pay with Paystack';
                            alert('Transaction was not completed, window closed.');
                        }
                    });
                    handler.openIframe();
                } else {
                    throw new Error(data.error || 'Failed to initiate transaction');
                }
            } catch (err) {
                console.error("Payment error:", err);
                alert('Error: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.innerText = 'Pay with Paystack';
            }
        });
    }
});
