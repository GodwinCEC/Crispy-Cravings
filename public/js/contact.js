// Contact Form Handling
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    const contactSuccess = document.getElementById('contact-success');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submit-contact');
            const originalBtnText = submitBtn.textContent;

            // Get form data
            const formData = {
                name: document.getElementById('contact-name').value.trim(),
                email: document.getElementById('contact-email').value.trim(),
                subject: document.getElementById('contact-subject').value,
                message: document.getElementById('contact-message').value.trim(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'unread'
            };

            // Loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';

            try {
                // Save to 'contacts' collection in Firestore
                await db.collection('contacts').add(formData);

                // Show success message
                contactForm.classList.add('hidden');
                contactSuccess.classList.remove('hidden');

                console.log('Contact message saved successfully');
            } catch (error) {
                console.error('Error sending message:', error);
                alert('Oops! There was an error sending your message. Please try again or call us directly.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
});

// Function to reset and show the form again
function resetContactForm() {
    const contactForm = document.getElementById('contact-form');
    const contactSuccess = document.getElementById('contact-success');

    contactForm.reset();
    contactForm.classList.remove('hidden');
    contactSuccess.classList.add('hidden');

    // Reset button
    const submitBtn = document.getElementById('submit-contact');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
}
