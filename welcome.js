document.addEventListener('DOMContentLoaded', () => {
    const sections = ['section-1', 'section-2', 'section-3'];
    let currentStep = 0;

    // Init Language
    if (window.initLanguage) window.initLanguage();

    // Elements
    const dots = document.querySelectorAll('.step');

    // Buttons
    const btnNext1 = document.getElementById('btn-next-1');
    const btnNext2 = document.getElementById('btn-next-2');
    const btnBack2 = document.getElementById('btn-back-2');
    const btnBack3 = document.getElementById('btn-back-3');
    const btnFinish = document.getElementById('btn-finish');

    function updateView(stepIndex) {
        // Update Sections
        sections.forEach((id, index) => {
            const el = document.getElementById(id);
            el.classList.remove('active-section', 'prev-section');
            el.classList.add('hidden-section');

            if (index === stepIndex) {
                // Slight delay to allow previous one to exit if needed, or instant
                el.classList.remove('hidden-section');
                void el.offsetWidth; // Trigger reflow
                el.classList.add('active-section');
            } else if (index < stepIndex) {
                el.classList.add('prev-section');
            }
        });

        // Update Dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === stepIndex);
        });

        currentStep = stepIndex;
    }

    // Event Listeners
    btnNext1.addEventListener('click', () => updateView(1));

    btnNext2.addEventListener('click', () => updateView(2));
    btnBack2.addEventListener('click', () => updateView(0));

    btnBack3.addEventListener('click', () => updateView(1));

    btnFinish.addEventListener('click', () => {
        // Close the welcome page or navigate to the main homepage
        // Since the prompt says "then we'll discuss how to create the extension's homepage",
        // we might just close this or show a "Done" message. 
        // For an extension, usually you close the tab or open the popup/options.
        // I will just alert for now or try to window.close().

        // In a real flow, this might open the main "dashboard" page if it exists.
        alert("Setup Complete! You're ready to use Capture Websites.");
        // window.close(); // Often scripts can't close tabs they didn't open, but extension pages can often close themselves.
    });

    // Initialize
    updateView(0);
});
